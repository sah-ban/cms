import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ComplaintForm, IntakeExtraction } from "./types";

const emptyForm: ComplaintForm = {
  complaint_source: "",
  customer_name: "",
  product_name: "",
  product_strength_grade: "",
  batch_lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  quantity_affected: "",
  complaint_type: "",
  complaint_date: "",
  description: "",
  initial_severity: "",
  priority: "",
  status: "Pending Triage",
  ai_summary: "",
  ai_risk_flags: ""
};

type ComplaintsState = {
  form: ComplaintForm;
  extractionProgress: number;
  assistantStatus: "idle" | "extracting" | "saving" | "saved" | "error";
  assistantMessage: string;
  savedCount: number;
};

const initialState: ComplaintsState = {
  form: emptyForm,
  extractionProgress: 0,
  assistantStatus: "idle",
  assistantMessage: "Upload a complaint document or paste text above. I will extract details and populate the form for QA review.",
  savedCount: 0
};

export const extractComplaint = createAsyncThunk<IntakeExtraction, string>(
  "complaints/extractComplaint",
  async (text) => {
    const response = await fetch("/api/ai/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error("AI extraction failed");
    }

    return response.json();
  }
);

export const saveComplaint = createAsyncThunk<void, ComplaintForm>(
  "complaints/saveComplaint",
  async (form) => {
    const response = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        manufacturing_date: form.manufacturing_date || null,
        expiry_date: form.expiry_date || null,
        complaint_date: form.complaint_date || null
      })
    });

    if (!response.ok) {
      throw new Error("Complaint save failed");
    }
  }
);

const complaintsSlice = createSlice({
  name: "complaints",
  initialState,
  reducers: {
    updateField: (state, action: PayloadAction<{ field: keyof ComplaintForm; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
    },
    resetForm: (state) => {
      state.form = emptyForm;
      state.extractionProgress = 0;
      state.assistantStatus = "idle";
      state.assistantMessage = initialState.assistantMessage;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(extractComplaint.pending, (state) => {
        state.assistantStatus = "extracting";
        state.extractionProgress = 35;
        state.assistantMessage = "Analyzing complaint content, identifying product and batch context, and flagging QMS risk signals.";
      })
      .addCase(extractComplaint.fulfilled, (state, action) => {
        state.assistantStatus = "idle";
        state.extractionProgress = 100;
        state.form = {
          ...state.form,
          ...action.payload,
          ai_risk_flags: action.payload.ai_risk_flags.join(", "),
          status: "Pending Triage"
        };
        state.assistantMessage = "Extraction complete. Review every populated field before saving the regulated complaint record.";
      })
      .addCase(extractComplaint.rejected, (state) => {
        state.assistantStatus = "error";
        state.extractionProgress = 0;
        state.assistantMessage = "AI extraction could not be completed. Paste less text or check the backend connection.";
      })
      .addCase(saveComplaint.pending, (state) => {
        state.assistantStatus = "saving";
        state.assistantMessage = "Saving complaint record to the QMS database.";
      })
      .addCase(saveComplaint.fulfilled, (state) => {
        state.assistantStatus = "saved";
        state.savedCount += 1;
        state.assistantMessage = "Complaint saved. QA triage can now determine investigation, CAPA, recall, or pharmacovigilance routing.";
      })
      .addCase(saveComplaint.rejected, (state) => {
        state.assistantStatus = "error";
        state.assistantMessage = "The complaint could not be saved. Check that the backend and database are running.";
      });
  }
});

export const { updateField, resetForm } = complaintsSlice.actions;
export default complaintsSlice.reducer;

