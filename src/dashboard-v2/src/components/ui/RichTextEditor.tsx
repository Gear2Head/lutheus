import { useRef, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Link, Link2Off, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Type, Eraser, Heading1, Heading2
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const TEXT_COLORS = [
  '#ffffff', '#F5F5F7', '#a0a0a8', '#636366',
  '#FF453A', '#FF9F0A', '#32D74B', '#5E5CE6',
  '#64D2FF', '#BF5AF2', '#FF375F', '#AC8E68',
];

const BG_COLORS = [
  'transparent', '#1c1c1e', '#2c2c2e', '#3a3a3c',
  '#3b1f1e', '#3b2e1e', '#1e3b20', '#1e1e3b',
  '#1e2c3b', '#2c1e3b', '#3b1e2c', '#2a221a',
];

export default function RichTextEditor({ value, onChange, placeholder, className, minHeight = '120px' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
      lastValue.current = value;
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) {
      const hadFocus = document.activeElement === editorRef.current;
      if (!hadFocus) {
        editorRef.current.innerHTML = value || '';
        lastValue.current = value;
      }
    }
  }, [value]);

  const exec = useCallback((command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    const html = editorRef.current?.innerHTML || '';
    lastValue.current = html;
    onChange(html);
  }, [onChange]);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    lastValue.current = html;
    onChange(html);
  }, [onChange]);

  const handleLink = () => {
    const sel = window.getSelection();
    if (sel && sel.toString()) {
      const url = prompt('Baglanti URL:', 'https://');
      if (url) exec('createLink', url);
    } else {
      exec('unlink');
    }
  };

  type ToolBtnProps = {
    onClick: () => void;
    title: string;
    active?: boolean;
    children: React.ReactNode;
  };

  const ToolBtn = ({ onClick, title, active, children }: ToolBtnProps) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
        active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-white/10 mx-0.5 self-center" />;

  return (
    <div className={`border border-white/[0.08] rounded-2xl overflow-hidden bg-black/20 ${className || ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] bg-black/30">
        <ToolBtn title="Baslik 1" onClick={() => exec('formatBlock', 'h1')}><Heading1 size={13} /></ToolBtn>
        <ToolBtn title="Baslik 2" onClick={() => exec('formatBlock', 'h2')}><Heading2 size={13} /></ToolBtn>
        <ToolBtn title="Normal Metin" onClick={() => exec('formatBlock', 'p')}><Type size={13} /></ToolBtn>
        <Divider />
        <ToolBtn title="Kalin (Bold)" onClick={() => exec('bold')}><Bold size={13} /></ToolBtn>
        <ToolBtn title="Italik" onClick={() => exec('italic')}><Italic size={13} /></ToolBtn>
        <ToolBtn title="Alti Cizili" onClick={() => exec('underline')}><Underline size={13} /></ToolBtn>
        <ToolBtn title="Ustu Cizili" onClick={() => exec('strikeThrough')}><Strikethrough size={13} /></ToolBtn>
        <Divider />
        <ToolBtn title="Sirasisiz Liste" onClick={() => exec('insertUnorderedList')}><List size={13} /></ToolBtn>
        <ToolBtn title="Sirali Liste" onClick={() => exec('insertOrderedList')}><ListOrdered size={13} /></ToolBtn>
        <Divider />
        <ToolBtn title="Sola Hizala" onClick={() => exec('justifyLeft')}><AlignLeft size={13} /></ToolBtn>
        <ToolBtn title="Ortala" onClick={() => exec('justifyCenter')}><AlignCenter size={13} /></ToolBtn>
        <ToolBtn title="Saga Hizala" onClick={() => exec('justifyRight')}><AlignRight size={13} /></ToolBtn>
        <Divider />
        <ToolBtn title="Baglanti Ekle/Kaldir" onClick={handleLink}><Link size={13} /></ToolBtn>
        <ToolBtn title="Baglanti Kaldir" onClick={() => exec('unlink')}><Link2Off size={13} /></ToolBtn>
        <Divider />
        <div className="relative group">
          <button type="button" title="Metin Rengi" className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1">
            <span className="text-[11px] font-bold leading-none" style={{fontFamily:'serif'}}>A</span>
          </button>
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-[#1a1a1e] border border-white/[0.08] rounded-xl z-50 hidden group-hover:flex flex-wrap gap-1 w-[102px] shadow-2xl">
            {TEXT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => exec('foreColor', c)}
                className="w-5 h-5 rounded-md border border-white/10 transition-transform hover:scale-110 cursor-pointer"
                style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </div>
        <div className="relative group">
          <button type="button" title="Arka Plan Rengi" className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <div className="w-3.5 h-3.5 rounded-sm bg-gradient-to-br from-white/30 to-white/5 border border-white/20" />
          </button>
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-[#1a1a1e] border border-white/[0.08] rounded-xl z-50 hidden group-hover:flex flex-wrap gap-1 w-[102px] shadow-2xl">
            {BG_COLORS.map(c => (
              <button key={c} type="button" onClick={() => exec('hiliteColor', c === 'transparent' ? 'transparent' : c)}
                className="w-5 h-5 rounded-md border border-white/10 transition-transform hover:scale-110 cursor-pointer"
                style={{ backgroundColor: c === 'transparent' ? 'rgba(255,255,255,0.08)' : c }} title={c === 'transparent' ? 'Temizle' : c} />
            ))}
          </div>
        </div>
        <Divider />
        <ToolBtn title="Bicimlendirmeyi Temizle" onClick={() => exec('removeFormat')}><Eraser size={13} /></ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder || 'Buraya yazin...'}
        className="outline-none text-white/80 text-xs leading-relaxed p-3 empty:before:content-[attr(data-placeholder)] empty:before:text-white/25 empty:before:pointer-events-none"
        style={{ minHeight }}
      />
      <style>{`
        [contenteditable] h1 { font-size: 1.1rem; font-weight: 700; margin: 4px 0; }
        [contenteditable] h2 { font-size: 0.9rem; font-weight: 700; margin: 4px 0; }
        [contenteditable] p  { margin: 0; }
        [contenteditable] ul { list-style: disc; padding-left: 1.2em; margin: 2px 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.2em; margin: 2px 0; }
        [contenteditable] a  { color: #5E5CE6; text-decoration: underline; cursor: pointer; }
      `}</style>

    </div>
  );
}
