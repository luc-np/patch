import type {
  TriageContext,
  TriageSuggestion,
  MarkdownEditRequest,
} from "./provider";

/** Implementação Anthropic — triagem e edição de Markdown (etapas seguintes). */
export async function generateTriage(_context: TriageContext): Promise<TriageSuggestion> {
  throw new Error("triagem ainda não implementada nesta etapa");
}

export async function generateMarkdownEdit(
  _request: MarkdownEditRequest,
): Promise<{ newContent: string }> {
  throw new Error("edição de markdown ainda não implementada nesta etapa");
}
