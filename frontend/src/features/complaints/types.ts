export type ComplaintForm = {
  complaint_source: string;
  customer_name: string;
  product_name: string;
  product_strength_grade: string;
  batch_lot_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_affected: string;
  complaint_type: string;
  complaint_date: string;
  description: string;
  initial_severity: string;
  priority: string;
  status: string;
  ai_summary: string;
  ai_risk_flags: string;
};

export type IntakeExtraction = Omit<ComplaintForm, "status" | "ai_risk_flags"> & {
  ai_risk_flags: string[];
};

export type ChatResponse = {
  answer: string;
  updates: Partial<ComplaintForm>;
};
