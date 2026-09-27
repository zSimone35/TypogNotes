import { useEffect, useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, Copy } from "lucide-react";

export const codeLanguages = [
  ["plaintext", "Testo"],
  ["bash", "Bash"],
  ["powershell", "PowerShell"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["jsx", "JSX"],
  ["tsx", "TSX"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["json", "JSON"],
  ["rust", "Rust"],
  ["python", "Python"],
  ["sql", "SQL"],
  ["markdown", "Markdown"],
] as const;

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (copied === "idle") return;
    const timer = window.setTimeout(() => setCopied("idle"), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <NodeViewWrapper className="code-block">
      <div className="code-block__header" contentEditable={false}>
        <select
          aria-label="Linguaggio del blocco codice"
          value={(node.attrs.language as string | null) ?? "plaintext"}
          onChange={(event) => updateAttributes({ language: event.target.value })}
        >
          {codeLanguages.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={copy} aria-label="Copia il blocco codice">
          {copied === "done" ? <Check size={14} /> : <Copy size={14} />}
          <span aria-live="polite">{copied === "done" ? "Copiato" : copied === "failed" ? "Non copiato" : "Copia"}</span>
        </button>
      </div>
      <pre>
        <NodeViewContent className="code-block__content" />
      </pre>
    </NodeViewWrapper>
  );
}
