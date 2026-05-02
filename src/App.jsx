import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  const [activeEvent, setActiveEvent] = useState(null);
  const chatEndRef = useRef(null);
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe curator ⚡️"
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);

  // --- LOGIQUE NOTIFICATIONS ---
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const sendLocalNotification = (title, body) => {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/vite.svg" });
    }
  };

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('god-mode-hub')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, payload => {
        sendLocalNotification("Nouveau Bail ! ⚡️", `${payload.new.title} vient d'être créé.`);
        fetchEvents();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        // Notification si nouveau message
        if (payload.new.comments?.length > payload.old.comments?.length) {
          const lastMsg = payload.new.comments[payload.new.comments.length - 1];
          if (lastMsg.user !== user.name) {
            sendLocalNotification(`Message sur ${payload.new.title}`, `${lastMsg.user}: ${lastMsg.text}`);
          }
        }
        fetchEvents();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeEvent?.comments]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end);
    if (data) {
      setEvents(data);
      if (activeEvent) {
        const updated = data.find(e => e.id === activeEvent.id);
        if (updated) setActiveEvent(updated);
      }
    }
  }

  const handleHype = async (e) => {
    await supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 }, colors: ['#D1FF4B', '#FF2E95'] });
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updated = isJoined ? current.filter(a => a.name !== user.name) : [...current, { name: user.name, avatar: user.avatar }];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Supprimer ce bail ? 🗑️")) return;
    await supabase.from('events').delete().eq('id', id);
    setActiveEvent(null);
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    await supabase.from('events').update({ comments: updatedComments, last_comment_at: new Date().toISOString() }).eq('id', event.id);
    setCommentInput("");
  };

  const handleSaveEvent = async () => {
    const data = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    await supabase.from('events').insert([{ ...data, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    setSelectedDay(null); setSelectedGif(null); setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00" });
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  const addToCalendar = (event) => {
    const start = format(new Date(`${event.date}T${event.time || '20:00'}`), "yyyyMMdd'T'HHmmss");
    const end = format(new Date(`${event.date}T235900`), "yyyyMMdd'T'HHmmss");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50">
        <h1 className="text-3xl font-black text-[#D1FF4B] italic tracking-tighter uppercase">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full cursor-pointer hover:border-[#FF2E95]/20 border border-white/10 transition-all">
          <img src={user.avatar} className="w-8 h-8 rounded-full border border-white/10 shadow-lg" alt="avatar" />
          <span className="text-[10px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
        </div>
      </header>

      {/* CALENDAR MAIN */}
      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-gradient-to-b from-[#0b0118] to-[#120428]">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm shadow-xl">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-all">◀</button>
          <h2 className="text-2xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black px-4 hover:scale-125 transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1.5 rounded-3xl overflow-hidden border border-white/5">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="bg-white/5 p-3 text-center text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">{d}</div>
          ))}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={i} 
                className={`relative min-h-0 p-3 border border-white/5 transition-all flex flex-col gap-2 ${isCurrent ? 'bg-white/5 hover:bg-white/10' : 'opacity-10 pointer-events-none'} ${isToday ? 'ring-1 ring-[#D1FF4B]' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && (
                    <button onClick={() => setSelectedDay(day)} className="text-[12px] opacity-0 group-hover:opacity-100 hover:text-[#D1FF4B] transition-all">+</button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar" onClick={() => isCurrent && dayEvents.length === 0 && setSelectedDay(day)}>
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} 
                      className={`p-2 rounded-xl text-[8px] font-black uppercase shadow-lg transition-all cursor-pointer border border-white/10 ${e.hype > 15 ? 'bg-[#D1FF4B] text-black' : 'bg-[#FF2E95] text-white hover:scale-95'}`}>
                      <div className="truncate mb-1">{e.title}</div>
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {e.attendees?.slice(0, 3).map((a, idx) => <img key={idx} src={a.avatar} className="w-4 h-4 rounded-full border border-black/20" alt="crew" />)}
                        </div>
                        {((e.comments?.length || 0) - (readComments[e.id] || 0)) > 0 && <div className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full animate-pulse ml-auto" />}
                      </div>
                    </div>
                  ))}
                  {isCurrent && dayEvents.length > 0 && (
                    <button onClick={(ev) => { ev.stopPropagation(); setSelectedDay(day); }} className="w-full py-1 border border-dashed border-white/10 rounded-lg text-[7px] font-black uppercase opacity-20 hover:opacity-100 transition-all">+ Nouveau</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* DETAILED EVENT OVERLAY */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-white/10 w-full max-w-5xl h-[85vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            {/* Colonne gauche (Info) */}
            <div className="md:w-1/2 flex flex-col bg-[#0e021f] overflow-y-auto custom-scrollbar">
              <div className="relative h-72 shrink-0">
                <img src={activeEvent.gif_url || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800`} className="w-full h-full object-cover" alt="vibe" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="bg-[#D1FF4B] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase mb-2 inline-block">{activeEvent.price || 'Gratuit'}</span>
                      <h3 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">{activeEvent.title}</h3>
                    </div>
                    <button onClick={() => addToCalendar(activeEvent)} className="bg-white/10 p-3 rounded-full hover:bg-[#00F0FF] transition-all">📅</button>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-8">
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/5 text-center"><p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1">Heure</p><p className="text-lg font-black">{activeEvent.time}</p></div>
                  <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/5 text-center"><p className="text-[9px] font-black uppercase opacity-40 text-[#00F0FF] mb-1 text-center truncate">Lieu</p><p className="text-xs font-black truncate">📍 {activeEvent.location}</p></div>
                </div>
                <p className="text-white/60 leading-relaxed font-medium">{activeEvent.description}</p>
                <div className="flex items-center justify-between bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="flex -space-x-3">{activeEvent.attendees?.map((a, i) => <img key={i} src={a.avatar} className="w-12 h-12 rounded-full border-4 border-[#0e021f]" alt="crew" />)}</div>
                  <button onClick={() => handleHype(activeEvent)} className="bg-[#D1FF4B] text-black px-6 py-3 rounded-2xl font-black">⚡️ {activeEvent.hype || 0}</button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleJoin(activeEvent)} className={`flex-1 py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl ${activeEvent.attendees?.some(a => a.name === user.name) ? 'bg-white/10 text-white' : 'bg-[#FF2E95] text-white hover:scale-105 transition-all'}`}>{activeEvent.attendees?.some(a => a.name === user.name) ? 'Inscrit ✔' : 'Participer'}</button>
                  {activeEvent.attendees?.[0]?.name === user.name && <button onClick={() => deleteEvent(activeEvent.id)} className="bg-red-500/20 text-red-500 p-5 rounded-3xl hover:bg-red-500 hover:text-white transition-all">🗑️</button>}
                </div>
              </div>
            </div>
            {/* Colonne droite (Chat fixe) */}
            <div className="md:w-1/2 flex flex-col bg-[#0b0118] border-l border-white/5 h-full overflow-hidden">
              <div className="p-8 border-b border-white/5 font-black uppercase text-xs tracking-widest text-[#00F0FF]">Live Discussion</div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-black uppercase opacity-40 mb-1 ml-2 mr-2">{c.user}</span>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" alt="user" />}
                      <div className={`p-4 rounded-3xl max-w-[280px] shadow-xl ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/10'}`}><p className="text-sm font-bold leading-tight">{c.text}</p><p className="text-[7px] text-right mt-2 opacity-40 font-black">{c.time}</p></div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/5 border-t border-white/5 flex gap-3">
                <input className="bg-transparent flex-1 font-bold outline-none text-sm text-white" placeholder="Message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest">OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL (Multi-event supporté) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-neon" onClick={e => e.stopPropagation()}>
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">Nouveau Bail</h3>
             <div className="space-y-4 mb-10">
               <input className="input-field" placeholder="Nom du bail" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Prix" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Lieu" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center"><p className="text-[8px] font-black uppercase text-[#00F0FF] mb-2 tracking-widest">Heure</p><input type="time" className="bg-transparent font-black w-full text-center outline-none text-white" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center"><p className="text-[8px] font-black uppercase text-[#00F0FF] mb-2 tracking-widest">Date</p><p className="font-black text-sm text-white">{format(selectedDay, 'dd MMM')}</p></div>
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               
               <div className="bg-white/5 p-5 rounded-[30px] border border-white/10 space-y-4">
                 <p className="text-[10px] font-black uppercase text-[#00F0FF] mb-2 tracking-widest text-center">Choisir un GIF</p>
                 <input className="input-field mb-4" placeholder="Rechercher..." value={gifSearch} onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => (
                     <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40 hover:opacity-100'}`} alt="gif" />
                   ))}
                 </div>
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-6 rounded-[30px] uppercase text-lg tracking-widest shadow-neon">Lancer le Bail</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-8 text-center">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95] shadow-2xl" alt="preview" />
                <input className="input-field text-center font-black uppercase text-xl" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Prénom" />
                <textarea className="input-field h-24 resize-none text-center" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Ma bio..." />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Enregistrer</button>
              </div>
           </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 20px rgba(209,255,75,0.3); } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #D1FF4B; border-radius: 10px; } .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 18px; font-weight: bold; color: white; width: 100%; outline: none; transition: all 0.3s; }`}</style>
    </div>
  )
}
export default App

