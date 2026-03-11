import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, Clock, Loader2, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserProfile, CalendarEvent } from '../lib/supabase';

interface CalendarViewProps {
    authUser: UserProfile;
}

export default function CalendarView({ authUser }: CalendarViewProps) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        fetchEvents();
    }, [currentDate]);

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            // Buscando eventos deste array de datas para a semana atual
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('sp3_calendar_events')
                .select('*')
                .eq('company_id', authUser.company_id!)
                .gte('start_time', startOfWeek.toISOString())
                .lte('start_time', endOfWeek.toISOString());

            if (!error && data) {
                setEvents(data);
            }
        } catch (err) {
            console.error('Erro ao buscar eventos:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Helper para formatar a semana
    const getDaysOfWeek = () => {
        const days = [];
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - currentDate.getDay());
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const weekDays = getDaysOfWeek();
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // Das 08h às 18h

    return (
        <div style={{ padding: '0 2rem 2rem 2rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'var(--accent)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <CalendarIcon size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                            {monthName}
                        </h1>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Gerencie seus compromissos e agendamentos automáticos da IA.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-soft)' }}>
                        <button onClick={handlePrevWeek} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)' }}>
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={handleToday} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 12px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            Hoje
                        </button>
                        <button onClick={handleNextWeek} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)' }}>
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} />
                        <span>Novo Agendamento</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="glass-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {isLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(var(--bg-primary-rgb), 0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                        <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }}/>
                    </div>
                )}
                
                {/* Headers da Semana */}
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-secondary)' }}>
                    <div style={{ borderRight: '1px solid var(--border-soft)' }}></div>
                    {weekDays.map((date, i) => {
                        const isToday = new Date().toDateString() === date.toDateString();
                        return (
                            <div key={i} style={{ padding: '12px', borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                                    {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--text-primary)', marginTop: '4px' }}>
                                    {date.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Grade de Horas */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', position: 'relative' }}>
                    {/* Renderizando as linhas das horas */}
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateRows: `repeat(${hours.length}, 60px)`, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                         {hours.map((hour, i) => (
                             <div key={hour} style={{ borderBottom: '1px solid var(--border-soft)', position: 'relative' }}></div>
                         ))}
                    </div>

                    {/* Coluna das legendas de hora */}
                    <div style={{ borderRight: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', zIndex: 2 }}>
                        {hours.map((hour) => (
                            <div key={hour} style={{ height: '60px', display: 'flex', justifyContent: 'center', paddingtop: '8px' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '-8px', background: 'var(--bg-secondary)', padding: '0 4px' }}>
                                    {String(hour).padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Colunas dos dias */}
                    {weekDays.map((date, dayIdx) => (
                        <div key={dayIdx} style={{ borderRight: dayIdx < 6 ? '1px solid var(--border-soft)' : 'none', position: 'relative' }}>
                            {events
                                .filter(e => new Date(e.start_time).toDateString() === date.toDateString())
                                .map(event => {
                                    const eventStart = new Date(event.start_time);
                                    const eventEnd = new Date(event.end_time);
                                    const startMin = (eventStart.getHours() - 8) * 60 + eventStart.getMinutes();
                                    const lengthMin = (eventEnd.getTime() - eventStart.getTime()) / 60000;
                                    
                                    // Limite visual
                                    if (startMin < 0 || startMin > hours.length * 60) return null;

                                    return (
                                        <div key={event.id} style={{
                                            position: 'absolute',
                                            top: `${startMin}px`,
                                            height: `${lengthMin}px`,
                                            left: '4px',
                                            right: '4px',
                                            background: event.status === 'cancelled' ? 'var(--bg-tertiary)' : 'var(--accent-soft)',
                                            border: `1px solid ${event.status === 'cancelled' ? 'var(--border-soft)' : 'var(--accent)'}`,
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            overflow: 'hidden',
                                            zIndex: 5,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                            opacity: event.status === 'cancelled' ? 0.6 : 1
                                        }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: event.status === 'cancelled' ? 'var(--text-muted)' : 'var(--accent)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {event.title}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                <Clock size={10} />
                                                {eventStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {eventEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {event.google_event_id && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#4285F4', marginTop: 'auto' }}>
                                                    <Video size={10} /> Sincronizado
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
