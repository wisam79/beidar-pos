import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pin, PinOff, Clock, Tag, CheckSquare, AlignLeft, Copy, Check } from 'lucide-react';

interface Note {
    id: string;
    content: string;
    color: string;
    pinned: boolean;
    isChecklist?: boolean;
    createdAt: number;
    updatedAt: number;
}

const COLORS = [
    { id: 'default', bg: 'bg-bg', border: 'border-border' },
    { id: 'yellow', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { id: 'green', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { id: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { id: 'pink', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
    { id: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
];

export const QuickNotes = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNote, setActiveNote] = useState<string | null>(null);
    const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const savedNotes = localStorage.getItem('beidar_quick_notes');
        if (savedNotes) {
            try { setNotes(JSON.parse(savedNotes)); } catch { /* ignore */ }
        }
    }, []);

    const saveNotes = (updatedNotes: Note[]) => {
        setNotes(updatedNotes);
        localStorage.setItem('beidar_quick_notes', JSON.stringify(updatedNotes));
    };

    const createNote = () => {
        const newNote: Note = {
            id: Date.now().toString(),
            content: '',
            color: 'default',
            pinned: false,
            isChecklist: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        saveNotes([newNote, ...notes]);
        setActiveNote(newNote.id);
    };

    const updateNote = (id: string, updates: Partial<Note>) => {
        saveNotes(notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n));
    };

    const deleteNote = (id: string) => {
        saveNotes(notes.filter(n => n.id !== id));
        if (activeNote === id) setActiveNote(null);
    };

    const formatDate = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'الآن';
        if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
        if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} س`;
        return new Date(timestamp).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
    };

    // Checklist Logic
    const toggleChecklistMode = (note: Note) => {
        updateNote(note.id, { isChecklist: !note.isChecklist });
    };

    const toggleChecklistItem = (note: Note, index: number) => {
        const lines = note.content.split('\n');
        const line = lines[index];
        if (line.startsWith('[x] ')) {
            lines[index] = line.replace('[x] ', '[ ] ');
        } else if (line.startsWith('[ ] ')) {
            lines[index] = line.replace('[ ] ', '[x] ');
        } else {
            lines[index] = '[x] ' + line;
        }
        updateNote(note.id, { content: lines.join('\n') });
    };

    // Pre-process content for checklist: ensure lines start with [ ] or [x] if they are just text
    // Only applied when switching TO checklist mode essentially, or just rendering.
    // Let's iterate lines and render.

    const sortedNotes = [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
    });

    const currentNote = notes.find(n => n.id === activeNote);
    const currentColor = COLORS.find(c => c.id === currentNote?.color) || COLORS[0];

    return (
        <div className="w-80 h-96 bg-surface flex flex-col font-sans select-none">
            {activeNote && currentNote ? (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-2.5 border-b border-white/5">
                        <button onClick={() => setActiveNote(null)} className="text-xs text-text-muted hover:text-text-main font-bold px-2">
                            ← العودة
                        </button>
                        <div className="flex gap-1">
                            <button
                                onClick={() => toggleChecklistMode(currentNote)}
                                className={`p-1.5 rounded-lg transition-colors ${currentNote.isChecklist ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-text-muted hover:text-text-main'}`}
                                title={currentNote.isChecklist ? "تحويل لنص" : "تحويل لقائمة"}
                            >
                                {currentNote.isChecklist ? <AlignLeft size={16} /> : <CheckSquare size={16} />}
                            </button>
                            <button
                                onClick={() => copyToClipboard(currentNote.content)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-colors"
                                title="نسخ النص"
                            >
                                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowColorPicker(showColorPicker === currentNote.id ? null : currentNote.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-colors"
                                >
                                    <Tag size={16} />
                                </button>
                                {showColorPicker === currentNote.id && (
                                    <div className="absolute top-full left-0 mt-2 bg-surface border border-white/10 rounded-xl p-2 flex gap-1.5 z-20 shadow-xl">
                                        {COLORS.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => { updateNote(currentNote.id, { color: c.id }); setShowColorPicker(null); }}
                                                className={`w-6 h-6 rounded-full ${c.bg} border-2 ${currentNote.color === c.id ? 'border-primary' : c.border} hover:scale-110 transition-transform`}
                                                title={c.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => updateNote(currentNote.id, { pinned: !currentNote.pinned })}
                                className={`p-1.5 rounded-lg transition-colors ${currentNote.pinned ? 'text-amber-400' : 'text-text-muted hover:text-text-main'}`}
                            >
                                {currentNote.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                            </button>
                            <button
                                onClick={() => deleteNote(currentNote.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Editor / Checklist View */}
                    <div className={`flex-1 p-3 m-2 rounded-xl border ${currentColor.bg} ${currentColor.border} overflow-hidden flex flex-col`}>
                        {currentNote.isChecklist ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                {currentNote.content.split('\n').map((line, idx) => {
                                    const isChecked = line.startsWith('[x] ');
                                    const text = line.replace(/^\[[ x]\] /, ''); // Remove prefix
                                    // If line is empty, skip or show placeholder input?
                                    // Just show text.
                                    return (
                                        <div key={idx} className="flex items-start gap-2 group min-h-[24px]">
                                            <button
                                                onClick={() => toggleChecklistItem(currentNote, idx)}
                                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-primary border-primary text-primary-fg' : 'border-text-muted hover:border-primary'}`}
                                            >
                                                {isChecked && <Check size={10} />}
                                            </button>
                                            <input
                                                type="text"
                                                value={text}
                                                onChange={(e) => {
                                                    const lines = currentNote.content.split('\n');
                                                    lines[idx] = (isChecked ? '[x] ' : '[ ] ') + e.target.value;
                                                    updateNote(currentNote.id, { content: lines.join('\n') });
                                                }}
                                                className={`flex-1 bg-transparent border-none p-0 text-sm focus:outline-none ${isChecked ? 'text-text-muted line-through' : 'text-text-main'}`}
                                                placeholder="مهمة جديدة..."
                                            />
                                            <button
                                                onClick={() => {
                                                    const lines = currentNote.content.split('\n');
                                                    lines.splice(idx, 1);
                                                    updateNote(currentNote.id, { content: lines.join('\n') });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity"
                                            >
                                                <XIcon size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={() => updateNote(currentNote.id, { content: currentNote.content + (currentNote.content ? '\n' : '') + '[ ] ' })}
                                    className="flex items-center gap-2 text-xs text-text-muted hover:text-primary mt-2"
                                >
                                    <Plus size={14} /> إضافة عنصر
                                </button>
                            </div>
                        ) : (
                            <textarea
                                className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-text-main placeholder:text-text-muted/50 leading-relaxed custom-scrollbar"
                                placeholder="اكتب ملاحظتك هنا..."
                                value={currentNote.content}
                                onChange={(e) => updateNote(currentNote.id, { content: e.target.value })}
                                autoFocus
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <span className="text-xs font-bold text-text-muted">{notes.length} ملاحظات</span>
                        <button onClick={createNote} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-primary-fg transition-all">
                            <Plus size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {sortedNotes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50">
                                <FileTextIcon size={40} className="mb-2" />
                                <span className="text-xs">لا توجد ملاحظات</span>
                            </div>
                        ) : (
                            sortedNotes.map(note => {
                                const noteColor = COLORS.find(c => c.id === note.color) || COLORS[0];
                                return (
                                    <div
                                        key={note.id}
                                        onClick={() => setActiveNote(note.id)}
                                        className={`p-3 rounded-xl border cursor-pointer hover:scale-[1.02] transition-all group relative ${noteColor.bg} ${noteColor.border}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm line-clamp-2 ${!note.content && 'italic opacity-50'}`}>
                                                {note.content || 'ملاحظة فارغة'}
                                            </p>
                                            {note.pinned && <Pin size={12} className="text-amber-400 flex-shrink-0" />}
                                        </div>
                                        <div className="text-[10px] text-text-muted mt-2 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(note.updatedAt)}</span>
                                            {note.isChecklist && <CheckSquare size={12} className="opacity-50" />}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple icons for empty state/remove
const XIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const FileTextIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
);
