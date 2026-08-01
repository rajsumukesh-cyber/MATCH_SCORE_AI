/**
 * Bias-detection module (server only).
 *
 * Two responsibilities:
 *  1. Redact personally identifying information before any resume text leaves
 *     this server for the AI model, so scoring can only use experience and
 *     topics — never identity.
 *  2. Scan resume and job text for signals that could introduce unfair bias
 *     (age, gender, nationality, marital status, photos, biased job wording).
 */

export interface BiasFlag {
  category:
    | "personal_identity"
    | "contact"
    | "age"
    | "gender"
    | "nationality"
    | "marital_family"
    | "photo"
    | "biased_job_wording";
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
  source: "resume" | "job";
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
const PHONE = /(?:\+?\d[\d\s()-]{7,}\d)/g;
const URL = /\bhttps?:\/\/\S+|\b(?:www\.|linkedin\.com\/|github\.com\/)\S+/gi;
const ADDRESS =
  /\b\d{1,4}\s+[A-Z][A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Block|Nagar|Colony)\b/g;
const DOB = /\b(?:date of birth|d\.?o\.?b\.?)\s*[:\-]?\s*[\w/,. -]{4,20}/gi;
const AGE = /\b(?:age)\s*[:\-]?\s*\d{1,2}\b/gi;
const GENDER = /\b(?:gender|sex)\s*[:\-]?\s*(?:male|female|other|m|f)\b/gi;
const MARITAL = /\b(?:marital status|married|unmarried|single|divorced|spouse)\b/gi;
const NATIONALITY = /\b(?:nationality|citizenship|religion|caste|race)\s*[:\-]?\s*[A-Za-z ]{2,20}/gi;
const PHOTO = /\b(?:photograph|passport size photo|profile photo|photo attached)\b/gi;

/** Words in a job description that commonly encode unfair preferences. */
const BIASED_JOB_TERMS: { term: RegExp; label: string; detail: string }[] = [
  {
    term: /\b(?:young|youthful|energetic young|fresh blood)\b/i,
    label: "Age-coded wording",
    detail: "Prefer 'early-career' or state the years of experience required instead.",
  },
  {
    term: /\b(?:recent graduate|digital native)\b/i,
    label: "Age-proxy wording",
    detail: "This filters by graduation year rather than by capability.",
  },
  {
    term: /\b(?:he\/she|his\/her|salesman|manpower|chairman|guys)\b/i,
    label: "Gendered wording",
    detail: "Use gender-neutral terms such as 'they', 'salesperson', 'workforce', 'chair'.",
  },
  {
    term: /\bnative (?:english )?speaker\b/i,
    label: "Nationality-coded wording",
    detail: "Specify the required proficiency level instead of a nationality proxy.",
  },
  {
    term: /\b(?:must be single|no family commitments|unmarried)\b/i,
    label: "Marital-status requirement",
    detail: "Marital or family status is not a job-related requirement.",
  },
  {
    term: /\b(?:only male|only female|male candidates|female candidates)\b/i,
    label: "Explicit gender requirement",
    detail: "Restricting a role by gender is discriminatory in most jurisdictions.",
  },
  {
    term: /\b(?:attach (?:a )?(?:recent )?photo|photograph is mandatory)\b/i,
    label: "Photo requirement",
    detail: "Photos invite appearance-based bias and are rarely job-related.",
  },
];

export interface RedactionResult {
  text: string;
  flags: BiasFlag[];
  redactedCount: number;
}

/**
 * Strips identity-revealing details from resume text. The redacted text is the
 * only version ever sent to the AI model when anonymous screening is on.
 */
export function redactPii(input: string, candidateName?: string | null): RedactionResult {
  const flags: BiasFlag[] = [];
  let count = 0;

  const replace = (
    text: string,
    pattern: RegExp,
    token: string,
    flag: Omit<BiasFlag, "source"> | null,
  ) => {
    let hit = false;
    const next = text.replace(pattern, () => {
      hit = true;
      count += 1;
      return token;
    });
    if (hit && flag) flags.push({ ...flag, source: "resume" });
    return next;
  };

  let text = input;

  if (candidateName && candidateName.trim().length > 2) {
    const escaped = candidateName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = replace(text, new RegExp(escaped, "gi"), "[CANDIDATE]", {
      category: "personal_identity",
      label: "Candidate name removed",
      detail: "The name was masked so scoring cannot be influenced by identity.",
      severity: "low",
    });
    for (const part of candidateName.trim().split(/\s+/)) {
      if (part.length > 3) {
        text = text.replace(
          new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
          "[CANDIDATE]",
        );
      }
    }
  }

  text = replace(text, EMAIL, "[EMAIL]", {
    category: "contact",
    label: "Email address removed",
    detail: "Contact details are never sent to the scoring model.",
    severity: "low",
  });
  text = replace(text, PHONE, "[PHONE]", {
    category: "contact",
    label: "Phone number removed",
    detail: "Contact details are never sent to the scoring model.",
    severity: "low",
  });
  text = replace(text, URL, "[LINK]", null);
  text = replace(text, ADDRESS, "[ADDRESS]", {
    category: "contact",
    label: "Street address removed",
    detail: "Location can act as a proxy for socio-economic background.",
    severity: "medium",
  });
  text = replace(text, DOB, "[DOB]", {
    category: "age",
    label: "Date of birth removed",
    detail: "Age is not job-related and is excluded from the score.",
    severity: "high",
  });
  text = replace(text, AGE, "[AGE]", {
    category: "age",
    label: "Age removed",
    detail: "Age is not job-related and is excluded from the score.",
    severity: "high",
  });
  text = replace(text, GENDER, "[GENDER]", {
    category: "gender",
    label: "Gender removed",
    detail: "Gender is not job-related and is excluded from the score.",
    severity: "high",
  });
  text = replace(text, MARITAL, "[PERSONAL]", {
    category: "marital_family",
    label: "Marital or family status removed",
    detail: "Family status is not job-related and is excluded from the score.",
    severity: "medium",
  });
  text = replace(text, NATIONALITY, "[PERSONAL]", {
    category: "nationality",
    label: "Nationality, religion or caste removed",
    detail: "Protected attributes are excluded from the score.",
    severity: "high",
  });
  text = replace(text, PHOTO, "[PHOTO]", {
    category: "photo",
    label: "Photo reference removed",
    detail: "Appearance must not influence shortlisting.",
    severity: "medium",
  });

  return { text, flags, redactedCount: count };
}

/** Flags wording in the job description that could exclude fair candidates. */
export function scanJobBias(jobText: string): BiasFlag[] {
  const flags: BiasFlag[] = [];
  for (const rule of BIASED_JOB_TERMS) {
    const match = jobText.match(rule.term);
    if (match) {
      flags.push({
        category: "biased_job_wording",
        label: rule.label,
        detail: `"${match[0].trim()}" — ${rule.detail}`,
        severity: "high",
        source: "job",
      });
    }
  }
  return flags;
}

export interface BiasSummary {
  anonymized: boolean;
  redactedFields: number;
  jobFlags: BiasFlag[];
  candidateFlagCount: number;
  fairnessNotes: string[];
}

export function summarizeBias(args: {
  anonymized: boolean;
  redactedFields: number;
  jobFlags: BiasFlag[];
  candidateFlagCount: number;
  scores: number[];
}): BiasSummary {
  const notes: string[] = [];
  notes.push(
    args.anonymized
      ? "Candidate identities were masked before scoring — the model saw experience and topics only."
      : "Anonymous mode was off, so the model could see identity details in the resumes.",
  );
  if (args.redactedFields > 0) {
    notes.push(`${args.redactedFields} personal detail(s) were removed across the candidate set.`);
  }
  if (args.jobFlags.length > 0) {
    notes.push(
      `${args.jobFlags.length} potentially biased phrase(s) were found in the job description.`,
    );
  } else {
    notes.push("No biased wording was detected in the job description.");
  }
  if (args.scores.length > 1) {
    const spread = Math.max(...args.scores) - Math.min(...args.scores);
    notes.push(
      spread > 55
        ? "Scores are widely spread — review the cutoff so borderline candidates are not lost."
        : "Scores are clustered, which suggests consistent evaluation across the set.",
    );
  }
  return {
    anonymized: args.anonymized,
    redactedFields: args.redactedFields,
    jobFlags: args.jobFlags,
    candidateFlagCount: args.candidateFlagCount,
    fairnessNotes: notes,
  };
}
