import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    if (!content) return null;

    // Split by newlines to handle blocks
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    let currentList: React.ReactNode[] = [];
    let inCodeBlock = false;

    lines.forEach((line, index) => {
        // Handle Code Blocks
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            return;
        }

        if (inCodeBlock) {
            elements.push(
                <div key={`code-${index}`} className="bg-black/30 p-2 rounded text-xs font-mono my-1 text-emerald-300">
                    {line}
                </div>
            );
            return;
        }

        // Handle Headers
        if (line.startsWith('### ')) {
            elements.push(<h3 key={index} className="text-sm font-bold mt-3 mb-1 text-purple-300">{line.replace('### ', '')}</h3>);
            return;
        }
        if (line.startsWith('## ')) {
            elements.push(<h2 key={index} className="text-base font-bold mt-4 mb-2 text-primary">{line.replace('## ', '')}</h2>);
            return;
        }

        // Handle Lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
            const text = line.replace(/^[-*•]\s+/, '');
            currentList.push(
                <li key={`li-${index}`} className="mb-1 ml-4 list-disc marker:text-primary">
                    {parseInline(text)}
                </li>
            );
            return;
        }

        // Flush list if we encounter non-list line
        if (currentList.length > 0) {
            elements.push(<ul key={`ul-${index}`} className="my-2 pl-4">{currentList}</ul>);
            currentList = [];
        }

        // Handle Empty Lines
        if (line.trim() === '') {
            elements.push(<div key={`br-${index}`} className="h-2" />);
            return;
        }

        // Regular Paragraph
        elements.push(
            <p key={`p-${index}`} className="mb-1 leading-relaxed">
                {parseInline(line)}
            </p>
        );
    });

    // Flush remaining list
    if (currentList.length > 0) {
        elements.push(<ul key="ul-end" className="my-2 pl-4">{currentList}</ul>);
    }

    return <div className={`text-sm ${className}`}>{elements}</div>;
};

// Helper to parse **bold** and *italic*
const parseInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};
