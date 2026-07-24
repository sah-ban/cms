import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ChatResponse, ComplaintForm, IntakeExtraction } from "./types";

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
  assistantStatus: "idle" | "extracting" | "chatting" | "saving" | "saved" | "error";
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

const allowedStatuses = ["Pending Triage", "QA Review", "Investigation", "CAPA Required", "Closed"];
const allowedSeverities = ["Low", "Medium", "High", "Critical"];
const allowedPriorities = ["Pending", "QA Review", "Investigation", "CAPA Review", "Recall Assessment", "Pharmacovigilance Review"];

const toDateInputValue = (value: string, monthOnlyDay: "first" | "last" = "first") => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return trimmed;
  }

  const isoMonth = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    const [, year, month] = isoMonth;
    const day = monthOnlyDay === "last" ? new Date(Number(year), Number(month), 0).getDate() : 1;
    return `${year}-${month}-${String(day).padStart(2, "0")}`;
  }

  const slashMonth = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMonth) {
    const [, rawMonth, year] = slashMonth;
    const month = rawMonth.padStart(2, "0");
    const day = monthOnlyDay === "last" ? new Date(Number(year), Number(month), 0).getDate() : 1;
    return `${year}-${month}-${String(day).padStart(2, "0")}`;
  }

  return trimmed;
};

const normalizeExtractionDates = (extraction: IntakeExtraction): IntakeExtraction => ({
  ...extraction,
  manufacturing_date: toDateInputValue(extraction.manufacturing_date),
  expiry_date: toDateInputValue(extraction.expiry_date, "last"),
  complaint_date: toDateInputValue(extraction.complaint_date)
});

const normalizeProductStrength = (extraction: IntakeExtraction): IntakeExtraction => {
  if (extraction.product_strength_grade.trim()) {
    return extraction;
  }

  const strengthMatch = extraction.product_name.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|ml|iu|%))\b/i);
  if (!strengthMatch) {
    return extraction;
  }

  return {
    ...extraction,
    product_name: extraction.product_name.replace(strengthMatch[0], "").replace(/\s{2,}/g, " ").trim(),
    product_strength_grade: strengthMatch[0].replace(/\s+/g, "")
  };
};

const normalizeExtraction = (extraction: IntakeExtraction): IntakeExtraction => normalizeProductStrength(normalizeExtractionDates(extraction));

const normalizeFormPatch = (patch: Partial<ComplaintForm>): Partial<ComplaintForm> => {
  const normalizedPatch = { ...patch };

  if (normalizedPatch.manufacturing_date) {
    normalizedPatch.manufacturing_date = toDateInputValue(normalizedPatch.manufacturing_date);
  }
  if (normalizedPatch.expiry_date) {
    normalizedPatch.expiry_date = toDateInputValue(normalizedPatch.expiry_date, "last");
  }
  if (normalizedPatch.complaint_date) {
    normalizedPatch.complaint_date = toDateInputValue(normalizedPatch.complaint_date);
  }
  if (normalizedPatch.product_name && !normalizedPatch.product_strength_grade) {
    const normalizedExtraction = normalizeProductStrength({
      ...emptyForm,
      ...normalizedPatch,
      ai_risk_flags: []
    });
    normalizedPatch.product_name = normalizedExtraction.product_name;
    normalizedPatch.product_strength_grade = normalizedExtraction.product_strength_grade;
  }
  if (normalizedPatch.status && !allowedStatuses.includes(normalizedPatch.status)) {
    delete normalizedPatch.status;
  }
  if (normalizedPatch.initial_severity && !allowedSeverities.includes(normalizedPatch.initial_severity)) {
    delete normalizedPatch.initial_severity;
  }
  if (normalizedPatch.priority && !allowedPriorities.includes(normalizedPatch.priority)) {
    delete normalizedPatch.priority;
  }

  return normalizedPatch;
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

export const extractComplaintDocument = createAsyncThunk<IntakeExtraction, File>(
  "complaints/extractComplaintDocument",
  async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/ai/document", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Document extraction failed");
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

export const askComplaintAssistant = createAsyncThunk<ChatResponse, { question: string; complaint: ComplaintForm }>(
  "complaints/askComplaintAssistant",
  async ({ question, complaint }) => {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, complaint })
    });

    if (!response.ok) {
      throw new Error("Assistant chat failed");
    }

    return response.json();
  }
);

const complaintsSlice = createSlice({
  name: "complaints",
  initialState,
  reducers: {
    updateField: (state, action: PayloadAction<{ field: keyof ComplaintForm; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
    },
    applyAssistantCommand: (state, action: PayloadAction<{ field: keyof ComplaintForm; value: string; message: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      state.assistantStatus = "idle";
      state.assistantMessage = action.payload.message;
    },
    setAssistantMessage: (state, action: PayloadAction<string>) => {
      state.assistantStatus = "idle";
      state.assistantMessage = action.payload;
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
        const extraction = normalizeExtraction(action.payload);
        state.assistantStatus = "idle";
        state.extractionProgress = 100;
        state.form = {
          ...state.form,
          ...extraction,
          ai_risk_flags: extraction.ai_risk_flags.join(", "),
          status: "Pending Triage"
        };
        state.assistantMessage = "Extraction complete. Review every populated field before saving the regulated complaint record.";
      })
      .addCase(extractComplaint.rejected, (state) => {
        state.assistantStatus = "error";
        state.extractionProgress = 0;
        state.assistantMessage = "AI extraction could not be completed. Paste less text or check the backend connection.";
      })
      .addCase(extractComplaintDocument.pending, (state) => {
        state.assistantStatus = "extracting";
        state.extractionProgress = 35;
        state.assistantMessage = "Reading document text and extracting complaint details.";
      })
      .addCase(extractComplaintDocument.fulfilled, (state, action) => {
        const extraction = normalizeExtraction(action.payload);
        state.assistantStatus = "idle";
        state.extractionProgress = 100;
        state.form = {
          ...state.form,
          ...extraction,
          ai_risk_flags: extraction.ai_risk_flags.join(", "),
          status: "Pending Triage"
        };
        state.assistantMessage = "Document extraction complete. Review every populated field before saving the regulated complaint record.";
      })
      .addCase(extractComplaintDocument.rejected, (state) => {
        state.assistantStatus = "error";
        state.extractionProgress = 0;
        state.assistantMessage = "Document extraction could not be completed. Check the file type, file text, and backend connection.";
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
      })
      .addCase(askComplaintAssistant.pending, (state) => {
        state.assistantStatus = "chatting";
        state.assistantMessage = "Reviewing the current complaint context.";
      })
      .addCase(askComplaintAssistant.fulfilled, (state, action) => {
        state.assistantStatus = "idle";
        state.form = {
          ...state.form,
          ...normalizeFormPatch(action.payload.updates)
        };
        state.assistantMessage = action.payload.answer;
      })
      .addCase(askComplaintAssistant.rejected, (state) => {
        state.assistantStatus = "error";
        state.assistantMessage = "The assistant could not answer right now. Check the backend connection and Groq configuration.";
      });
  }
});

export const { applyAssistantCommand, resetForm, setAssistantMessage, updateField } = complaintsSlice.actions;
export default complaintsSlice.reducer;
