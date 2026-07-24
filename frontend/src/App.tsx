import { AlertTriangle, Bot, Calendar, ClipboardList, RotateCcw, Save, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import { askComplaintAssistant, resetForm, saveComplaint, updateField } from "./features/complaints/complaintsSlice";
import type { ComplaintForm } from "./features/complaints/types";

type FieldConfig = {
  key: keyof ComplaintForm;
  label: string;
  type?: string;
  span?: "full";
  suffix?: string;
  options?: string[];
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

const sections: { title: string; fields: FieldConfig[] }[] = [
  {
    title: "1. Origin & Customer Details",
    fields: [
      { key: "complaint_source", label: "Complaint Source" },
      { key: "customer_name", label: "Customer Name" }
    ]
  },
  {
    title: "2. Product & Batch Identification",
    fields: [
      { key: "product_name", label: "Product Name" },
      { key: "product_strength_grade", label: "Product Strength/Grade" },
      { key: "batch_lot_number", label: "Batch/Lot Number" },
      { key: "manufacturing_date", label: "Manufacturing Date", type: "date" },
      { key: "expiry_date", label: "Expiry Date", type: "date" },
      { key: "quantity_affected", label: "Quantity Affected", suffix: "kg" }
    ]
  },
  {
    title: "3. Complaint Details",
    fields: [
      { key: "complaint_type", label: "Complaint Type" },
      { key: "complaint_date", label: "Complaint Date", type: "date" },
      { key: "description", label: "Detailed Complaint Description", span: "full" }
    ]
  },
  {
    title: "4. Initial Assessment & Priority",
    fields: [
      { key: "initial_severity", label: "Initial Severity", options: ["Low", "Medium", "High", "Critical"] },
      { key: "priority", label: "Priority", options: ["Pending", "QA Review", "Investigation", "CAPA Review", "Recall Assessment", "Pharmacovigilance Review"] }
    ]
  }
];

function Field({ config }: { config: FieldConfig }) {
  const dispatch = useAppDispatch();
  const value = useAppSelector((state) => state.complaints.form[config.key]);
  const className = config.span === "full" ? "form-field full" : "form-field";

  return (
    <label className={className}>
      <span>{config.label}</span>
      <div className="input-shell">
        {config.options ? (
          <select value={value} onChange={(event) => dispatch(updateField({ field: config.key, value: event.target.value }))}>
            <option value="">Awaiting AI extraction...</option>
            {config.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : config.span === "full" ? (
          <textarea
            value={value}
            placeholder="Awaiting AI extraction..."
            onChange={(event) => dispatch(updateField({ field: config.key, value: event.target.value }))}
          />
        ) : (
          <input
            value={value}
            type={config.type ?? "text"}
            placeholder={config.type === "date" ? "" : "Awaiting AI extraction..."}
            onChange={(event) => dispatch(updateField({ field: config.key, value: event.target.value }))}
          />
        )}
        {config.type === "date" && <Calendar size={16} className="input-icon" aria-hidden="true" />}
        {config.suffix && <span className="suffix">{config.suffix}</span>}
      </div>
    </label>
  );
}

function ComplaintFormPanel() {
  const dispatch = useAppDispatch();
  const form = useAppSelector((state) => state.complaints.form);
  const status = useAppSelector((state) => state.complaints.assistantStatus);

  return (
    <section className="panel complaint-panel" aria-labelledby="complaint-title">
      <header className="panel-header">
        <div>
          <h1 id="complaint-title">Log Customer Complaint</h1>
          <p>API & FDF Quality Assurance Module</p>
        </div>
        <span className="status-pill">{form.status}</span>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          dispatch(saveComplaint(form));
        }}
      >
        {sections.map((section) => (
          <fieldset key={section.title} className="form-section">
            <legend>{section.title}</legend>
            <div className="field-grid">
              {section.fields.map((field) => (
                <Field key={field.key} config={field} />
              ))}
            </div>
          </fieldset>
        ))}

        <div className="risk-strip">
          <AlertTriangle size={16} />
          <span>{form.ai_risk_flags || "AI risk flags will appear after intake extraction."}</span>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => dispatch(resetForm())}>
            <RotateCcw size={16} />
            Reset Form
          </button>
          <button type="submit" className="primary-button" disabled={status === "saving"}>
            <Save size={16} />
            {status === "saving" ? "Saving..." : "Save Complaint"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AssistantPanel() {
  const dispatch = useAppDispatch();
  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content: "Paste complaint text, ask a triage question, or tell me to update a field in the complaint record."
    }
  ]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(2);
  const { assistantStatus, savedCount, form } = useAppSelector((state) => state.complaints);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: ChatMessage["role"], content: string) => {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: nextMessageId.current++,
        role,
        content
      }
    ]);
  };

  const handleChatSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedMessage = composerText.trim();
    if (trimmedMessage) {
      addMessage("user", trimmedMessage);
      setComposerText("");

      try {
        const response = await dispatch(askComplaintAssistant({ question: trimmedMessage, complaint: form })).unwrap();
        addMessage("assistant", response.answer);
      } catch {
        addMessage("assistant", "I could not answer right now. Check the backend connection and Groq configuration.");
      }
    }
  };

  const isWorking = assistantStatus === "extracting" || assistantStatus === "chatting";

  return (
    <aside className="panel assistant-panel" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <div className="assistant-title">
          <Sparkles size={21} />
          <h2 id="assistant-title">AI Complaint Intake Assistant</h2>
        </div>
        <span className="beta-pill">BETA</span>
      </header>

      <div className="chat-transcript" ref={transcriptRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            {message.role === "assistant" && <Bot size={18} aria-hidden="true" />}
            <p>{message.content}</p>
          </div>
        ))}
        {isWorking && (
          <div className="chat-message assistant">
            <Bot size={18} aria-hidden="true" />
            <p>{assistantStatus === "extracting" ? "Extracting complaint details..." : "Reviewing the current complaint context..."}</p>
          </div>
        )}
      </div>

      <div className="qa-context">
        <div>
          <ClipboardList size={18} />
          <span>QMS Routing</span>
        </div>
        <dl>
          <dt>Severity</dt>
          <dd>{form.initial_severity || "Unclassified"}</dd>
          <dt>Priority</dt>
          <dd>{form.priority || "Pending"}</dd>
          <dt>Saved</dt>
          <dd>{savedCount}</dd>
        </dl>
      </div>

      <form onSubmit={handleChatSubmit} className="chat-composer">
        <textarea
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          placeholder="Paste complaint text or ask about this complaint..."
          aria-label="Ask assistant about this complaint"
        />
        <button
          type="submit"
          className="primary-button icon-button"
          aria-label="Send message"
          disabled={!composerText.trim() || isWorking}
        >
          <Send size={18} />
        </button>
      </form>
      <p className="disclaimer">AI responses may contain errors. Please verify information.</p>
    </aside>
  );
}

export default function App() {
  return (
    <main className="app-shell">
      <ComplaintFormPanel />
      <AssistantPanel />
    </main>
  );
}
