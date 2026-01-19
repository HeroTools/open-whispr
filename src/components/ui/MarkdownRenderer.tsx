import Markdown from "react-markdown";
import { cn } from "../lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <Markdown
      className={cn("prose prose-sm max-w-none", className)}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-foreground">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-foreground">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 text-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1 text-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1 text-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-muted p-2 rounded overflow-x-auto text-xs mb-2 text-foreground">
            {children}
          </pre>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 italic my-2 text-muted-foreground">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,
      }}
    >
      {content}
    </Markdown>
  );
}

export default MarkdownRenderer;
