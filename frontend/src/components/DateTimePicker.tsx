import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, X } from 'lucide-react';

interface DateTimePickerProps {
    value: string; // ISO string or datetime-local format "YYYY-MM-DDTHH:mm"
    onChange: (value: string) => void;
    placeholder?: string;
    compact?: boolean; // smaller variant for sidebar use
    minDate?: Date;
}

const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export default function DateTimePicker({ value, onChange, placeholder = 'Selecionar data e hora', compact = false, minDate }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'date' | 'time'>('date');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Parse current value
    const parsed = value ? new Date(value) : null;
    const [viewYear, setViewYear] = useState(parsed?.getFullYear() || new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
    const [selectedDate, setSelectedDate] = useState<Date | null>(parsed);
    const [selectedHour, setSelectedHour] = useState(parsed?.getHours() ?? 9);
    const [selectedMinute, setSelectedMinute] = useState(parsed?.getMinutes() ?? 0);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Position dropdown
    useEffect(() => {
        if (isOpen && dropdownRef.current && containerRef.current) {
            const trigger = containerRef.current.getBoundingClientRect();
            const dropdown = dropdownRef.current;
            const vp = window.innerHeight;
            const spaceBelow = vp - trigger.bottom;
            if (spaceBelow < 380) {
                dropdown.style.bottom = '100%';
                dropdown.style.top = 'auto';
                dropdown.style.marginBottom = '4px';
            } else {
                dropdown.style.top = '100%';
                dropdown.style.bottom = 'auto';
                dropdown.style.marginTop = '4px';
            }
        }
    }, [isOpen]);

    const emitValue = (date: Date, hour: number, minute: number) => {
        const d = new Date(date);
        d.setHours(hour, minute, 0, 0);
        // Format as datetime-local value
        const pad = (n: number) => n.toString().padStart(2, '0');
        onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`);
    };

    const handleDateSelect = (day: number) => {
        const d = new Date(viewYear, viewMonth, day);
        setSelectedDate(d);
        setStep('time');
    };

    const handleTimeConfirm = () => {
        if (selectedDate) {
            emitValue(selectedDate, selectedHour, selectedMinute);
        }
        setIsOpen(false);
        setStep('date');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSelectedDate(null);
        setStep('date');
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isDisabled = (day: number) => {
        if (!minDate) return false;
        const d = new Date(viewYear, viewMonth, day);
        return d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        return selectedDate.getDate() === day && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear;
    };

    const isToday = (day: number) => {
        const now = new Date();
        return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    };

    // Display text
    const displayText = parsed
        ? `${parsed.getDate().toString().padStart(2, '0')}/${(parsed.getMonth() + 1).toString().padStart(2, '0')}/${parsed.getFullYear()} às ${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`
        : '';

    const sz = compact ? 0.68 : 0.78;
    const cellSz = compact ? 28 : 32;

    const triggerStyle: CSSProperties = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '6px 8px' : '8px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: `${sz}rem`,
        cursor: 'pointer',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.15s',
        outline: 'none',
        fontWeight: value ? '600' : '400',
    };

    const dropdownStyle: CSSProperties = {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        minWidth: compact ? '250px' : '280px',
    };

    const headerBtnStyle: CSSProperties = {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        padding: '4px',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) setStep('date'); }}
                style={triggerStyle}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
                <CalendarIcon size={compact ? 12 : 14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayText || placeholder}
                </span>
                {value && (
                    <span
                        onClick={handleClear}
                        style={{ flexShrink: 0, opacity: 0.4, display: 'flex', padding: '2px', borderRadius: '50%', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                    >
                        <X size={compact ? 10 : 12} />
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div ref={dropdownRef} style={dropdownStyle}>
                    {/* Step indicator */}
                    <div style={{
                        display: 'flex', borderBottom: '1px solid var(--border-soft)',
                        background: 'var(--bg-secondary)',
                    }}>
                        <button
                            type="button"
                            onClick={() => setStep('date')}
                            style={{
                                flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                                fontSize: `${sz - 0.04}rem`, fontWeight: '700',
                                background: step === 'date' ? 'var(--bg-primary)' : 'transparent',
                                color: step === 'date' ? 'var(--accent)' : 'var(--text-muted)',
                                borderBottom: step === 'date' ? '2px solid var(--accent)' : '2px solid transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                transition: 'all 0.15s',
                            }}
                        >
                            <CalendarIcon size={12} /> Data
                        </button>
                        <button
                            type="button"
                            onClick={() => selectedDate && setStep('time')}
                            style={{
                                flex: 1, padding: '8px', border: 'none', cursor: selectedDate ? 'pointer' : 'not-allowed',
                                fontSize: `${sz - 0.04}rem`, fontWeight: '700',
                                background: step === 'time' ? 'var(--bg-primary)' : 'transparent',
                                color: step === 'time' ? 'var(--accent)' : 'var(--text-muted)',
                                borderBottom: step === 'time' ? '2px solid var(--accent)' : '2px solid transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                opacity: selectedDate ? 1 : 0.4,
                                transition: 'all 0.15s',
                            }}
                        >
                            <Clock size={12} /> Hora
                        </button>
                    </div>

                    {step === 'date' && (
                        <div style={{ padding: compact ? '8px' : '12px' }}>
                            {/* Month/Year header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <button type="button" onClick={prevMonth} style={headerBtnStyle}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: `${sz}rem`, fontWeight: '800', color: 'var(--text-primary)' }}>
                                    {MONTHS_PT[viewMonth]} {viewYear}
                                </span>
                                <button type="button" onClick={nextMonth} style={headerBtnStyle}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* Weekday headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                                {WEEKDAYS_PT.map((d, i) => (
                                    <div key={i} style={{
                                        textAlign: 'center', fontSize: `${sz - 0.1}rem`, fontWeight: '700',
                                        color: 'var(--text-muted)', padding: '4px 0',
                                    }}>
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Days grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                                {/* Empty cells for offset */}
                                {Array.from({ length: firstDay }, (_, i) => (
                                    <div key={`empty-${i}`} style={{ height: cellSz }} />
                                ))}
                                {/* Day cells */}
                                {Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const disabled = isDisabled(day);
                                    const selected = isSelected(day);
                                    const todayMark = isToday(day);
                                    return (
                                        <button
                                            type="button"
                                            key={day}
                                            disabled={disabled}
                                            onClick={() => handleDateSelect(day)}
                                            style={{
                                                width: cellSz, height: cellSz,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: 'none', borderRadius: 'var(--radius-sm)',
                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                                fontSize: `${sz - 0.02}rem`,
                                                fontWeight: selected || todayMark ? '800' : '500',
                                                background: selected ? 'var(--accent)' : 'transparent',
                                                color: selected ? (document.documentElement.classList.contains('dark-mode') ? '#000' : '#fff')
                                                    : disabled ? 'var(--border)' : todayMark ? 'var(--accent)' : 'var(--text-primary)',
                                                transition: 'all 0.12s',
                                                position: 'relative',
                                            }}
                                            onMouseEnter={e => {
                                                if (!disabled && !selected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            }}
                                            onMouseLeave={e => {
                                                if (!disabled && !selected) e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            {day}
                                            {todayMark && !selected && (
                                                <span style={{
                                                    position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                                                    width: '4px', height: '4px', borderRadius: '50%',
                                                    background: 'var(--accent)',
                                                }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Quick actions */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-soft)' }}>
                                {[
                                    { label: 'Hoje', offset: 0 },
                                    { label: 'Amanhã', offset: 1 },
                                    { label: '+7 dias', offset: 7 },
                                ].map(q => (
                                    <button
                                        type="button"
                                        key={q.label}
                                        onClick={() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + q.offset);
                                            d.setHours(0, 0, 0, 0);
                                            setSelectedDate(d);
                                            setViewMonth(d.getMonth());
                                            setViewYear(d.getFullYear());
                                            setStep('time');
                                        }}
                                        style={{
                                            flex: 1, padding: '5px 0', border: '1px solid var(--border-soft)',
                                            borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                                            color: 'var(--text-secondary)', fontSize: `${sz - 0.08}rem`, fontWeight: '600',
                                            cursor: 'pointer', transition: 'all 0.12s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = document.documentElement.classList.contains('dark-mode') ? '#000' : '#fff'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'time' && (
                        <div style={{ padding: compact ? '10px' : '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Selected date display */}
                            {selectedDate && (
                                <div style={{
                                    textAlign: 'center', fontSize: `${sz}rem`, fontWeight: '700',
                                    color: 'var(--text-primary)', padding: '6px',
                                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                                }}>
                                    {selectedDate.getDate().toString().padStart(2, '0')}/{(selectedDate.getMonth() + 1).toString().padStart(2, '0')}/{selectedDate.getFullYear()}
                                </div>
                            )}

                            {/* Hour/Minute selectors */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {/* Hours */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: `${sz - 0.1}rem`, fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora</span>
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px',
                                        maxHeight: '160px', overflowY: 'auto', padding: '2px',
                                    }}>
                                        {Array.from({ length: 24 }, (_, h) => (
                                            <button
                                                type="button"
                                                key={h}
                                                onClick={() => setSelectedHour(h)}
                                                style={{
                                                    width: compact ? 36 : 40, height: compact ? 28 : 30,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    border: 'none', borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    fontSize: `${sz - 0.02}rem`, fontWeight: selectedHour === h ? '800' : '500',
                                                    background: selectedHour === h ? 'var(--accent)' : 'transparent',
                                                    color: selectedHour === h
                                                        ? (document.documentElement.classList.contains('dark-mode') ? '#000' : '#fff')
                                                        : 'var(--text-primary)',
                                                    transition: 'all 0.12s',
                                                }}
                                                onMouseEnter={e => { if (selectedHour !== h) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                onMouseLeave={e => { if (selectedHour !== h) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {h.toString().padStart(2, '0')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Separator */}
                                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-muted)', marginTop: '20px' }}>:</span>

                                {/* Minutes */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: `${sz - 0.1}rem`, fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min</span>
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px',
                                        maxHeight: '160px', overflowY: 'auto', padding: '2px',
                                    }}>
                                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                            <button
                                                type="button"
                                                key={m}
                                                onClick={() => setSelectedMinute(m)}
                                                style={{
                                                    width: compact ? 36 : 40, height: compact ? 28 : 30,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    border: 'none', borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    fontSize: `${sz - 0.02}rem`, fontWeight: selectedMinute === m ? '800' : '500',
                                                    background: selectedMinute === m ? 'var(--accent)' : 'transparent',
                                                    color: selectedMinute === m
                                                        ? (document.documentElement.classList.contains('dark-mode') ? '#000' : '#fff')
                                                        : 'var(--text-primary)',
                                                    transition: 'all 0.12s',
                                                }}
                                                onMouseEnter={e => { if (selectedMinute !== m) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                onMouseLeave={e => { if (selectedMinute !== m) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {m.toString().padStart(2, '0')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Time preview + confirm */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                borderTop: '1px solid var(--border-soft)', paddingTop: '10px',
                            }}>
                                <div style={{
                                    flex: 1, textAlign: 'center', fontSize: '1.1rem', fontWeight: '800',
                                    color: 'var(--accent)', letterSpacing: '0.05em',
                                }}>
                                    {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleTimeConfirm}
                                    style={{
                                        padding: compact ? '7px 16px' : '8px 20px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: 'none', background: 'var(--accent)',
                                        color: document.documentElement.classList.contains('dark-mode') ? '#000' : '#fff',
                                        fontSize: `${sz}rem`, fontWeight: '800',
                                        cursor: 'pointer', transition: 'opacity 0.12s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
