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
  const [activeEvent, setActiveEvent] = useState(null);
  const chatEndRef = useRef(null);
  
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe curator ⚡️",
    location: "", spotify: "", instagram: ""
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
    const channel = supabase.channel('v20-final-lock').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents()).subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user]);

  useEffect(() => {
    if (activeEvent) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [activeEvent?.comments]);

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

  const handleSaveEvent = async () => {
    const dataToSave = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) {
      const { data, error } = await supabase.from('events').update(dataToSave).eq('id', editingEventId).select();
      if (!error && data) {
        setActiveEvent(data[0]); // Garde la fiche ouverte avec les nouvelles infos
        setEditingEventId(null);
        setSelectedDay(null);
      }
    } else {
      await supabase.from('events').insert([{ ...dataToSave, attendees: [{ ...user, has_ticket: false }] }]);
      setSelectedDay(null);
    }
    setForm({ title: "", price: "", location: "", description: "", recap_url: "", time: "20:00", ticket_url: "", event_url: "", is_public: false, tags: "" });
  };

  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    const current = event.attendees || [];
    const isJoined = current.some(a => a.name === user.name);
    const updatedAttendees = isJoined 
      ? current.filter(a => a.name !== user.name) 
      : [...current, { ...user, has_ticket: false }];
    setActiveEvent({ ...event, attendees: updatedAttendees });
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
  };

  const toggleTicketStatus = async (event) => {
    const updatedAttendees = event.attendees.map(a => a.name === user.name ? { ...a, has_ticket: !a.has_ticket } : a);
    setActiveEvent({ ...event, attendees: updatedAttendees });
    await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!event.attendees.find(a => a.name === user.name)?.has_ticket) confetti({ particleCount: 60 });
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    setActiveEvent({ ...event, comments: updatedComments });
    await supabase.from('events').update({ comments: updatedComments }).eq('id', event.id);
    setCommentInput("");
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="h-screen bg-[#0b0118] text-white font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 md:px-10 flex justify-between items-center border-b border-white/5 bg-[#0b0118]/80 backdrop-blur-md z-50 shrink-0">
        <h1 className="text-2xl font-black text-[#D1FF4B] italic uppercase tracking-tighter">Social Hub</h1>
        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full cursor-pointer metal-bg border border-white/10 transition-all hover:scale-105">
          <img src={user.avatar} className="w-9 h-9 rounded-full border border-white/20" alt="avatar" />
          <span className="text-[11px] font-black uppercase tracking-widest">{user.name || "Identity"}</span>
        </div>
      </header>

      {/* CALENDAR */}
      <main className="flex-1 flex flex-col p-3 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-2xl border border-white/10 shrink-0">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-[#00F0FF] hover:text-black transition-all">◀</button>
          <h2 className="text-xl md:text-2xl font-black uppercase italic text-[#D1FF4B] tracking-widest">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-[#00F0FF] hover:text-black transition-all">▶</button>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1.5 rounded-3xl overflow-hidden border border-white/10">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-white/5 p-2 text-center text-[11px] font-black opacity-30 uppercase">{d}</div>)}
          {eachDayOfInterval({ 
            start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
            end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
          }).map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
            const isCurrent = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} className={`relative min-h-0 p-3 border border-white/5 flex flex-col gap-1 transition-all ${isCurrent ? 'bg-white/5 hover:bg-white/[0.08] cursor-pointer' : 'opacity-10 pointer-events-none'} ${isToday ? 'bg-[#D1FF4B]/5 ring-1 ring-[#D1FF4B]/30' : ''}`} 
                   onClick={() => isCurrent && setSelectedDay(day)}>
                <div className="flex justify-between items-start shrink-0">
                  <span className={`text-[15px] font-black ${isToday ? 'text-[#D1FF4B]' : 'opacity-30'}`}>{format(day, 'd')}</span>
                  {isCurrent && <span className="text-[16px] opacity-20 text-[#D1FF4B]">+</span>}
                </div>
                <div className="flex-1 overflow-hidden space-y-1">
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); setActiveEvent(e); }} 
                      className={`p-2 rounded-xl text-[9px] font-black uppercase truncate border border-white/10 shadow-lg ${e.is_public ? 'bg-[#00F0FF] text-black' : 'bg-[#FF2E95] text-white'}`}>
                      {e.title}
                      <div className="flex -space-x-1.5 mt-1.5">
                        {e.attendees?.slice(0, 4).map((a, idx) => (
                           <img key={idx} src={a.avatar} className="w-5 h-5 rounded-full border-2 border-[#1a0b2e] metal-bg" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* EVENT MODAL - FIXED 13"/16" */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setActiveEvent(null)}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] w-full max-w-6xl h-[85vh] rounded-[50px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Info Side */}
            <div className="md:w-[45%] flex flex-col bg-[#0e021f] h-full border-r border-white/10 overflow-hidden">
              <div className="relative h-56 md:h-64 shrink-0">
                <img src={activeEvent.gif_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e021f] to-transparent" />
                <div className="absolute top-6 right-6 flex gap-2">
                   <button onClick={() => { setEditingEventId(activeEvent.id); setForm(activeEvent); setSelectedDay(new Date(activeEvent.date)); setSelectedGif(activeEvent.gif_url); }} className="bg-black/60 p-3 rounded-full border border-white/10 hover:bg-[#D1FF4B] hover:text-black transition-all">✏️</button>
                   <button onClick={() => { if(window.confirm("Delete?")) supabase.from('events').delete().eq('id', activeEvent.id).then(() => setActiveEvent(null)) }} className="bg-black/60 p-3 rounded-full border border-white/10 hover:bg-red-500 transition-all">🗑️</button>
                </div>
                <div className="absolute bottom-6 left-8">
                  <h3 className="text-4xl font-black uppercase text-white tracking-tighter truncate">{activeEvent.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeEvent.tags?.split(',').map((tag, idx) => <span key={idx} className="text-[8px] font-black bg-[#D1FF4B]/20 text-[#D1FF4B] px-2 py-0.5 rounded-md uppercase">#{tag.trim()}</span>)}
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-3 shrink-0">
                   {activeEvent.ticket_url && <a href={activeEvent.ticket_url} target="_blank" className="bg-[#00F0FF] text-black text-center py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Tickets 🎫</a>}
                   {activeEvent.event_url && <a href={activeEvent.event_url} target="_blank" className="bg-white/10 text-white text-center py-3 rounded-2xl font-black uppercase text-[10px] border border-white/10">Website 🔗</a>}
                </div>

                <div className="grid grid-cols-3 gap-3 shrink-0">
                  <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5"><p className="text-[7px] font-black uppercase opacity-40 text-[#00F0FF] mb-0.5">Time</p><p className="font-black text-sm">{activeEvent.time}</p></div>
                  <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5"><p className="text-[7px] font-black uppercase opacity-40 text-[#00F0FF] mb-0.5">Price</p><p className="font-black text-sm">{activeEvent.price || 'Free'}</p></div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center flex flex-col justify-center"><p className="text-[7px] font-black uppercase opacity-40 text-[#00F0FF]">Place</p><p className="text-[9px] font-black truncate">📍 {activeEvent.location}</p></div>
                </div>

                <p className="text-white/60 text-sm italic line-clamp-2 leading-relaxed">"{activeEvent.description || "No description."}"</p>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <p className="text-[9px] font-black uppercase opacity-40 mb-3 tracking-widest">The Crew ({activeEvent.attendees?.length || 0})</p>
                  <div className="flex-1 overflow-y-auto flex flex-wrap gap-4 content-start custom-scrollbar">
                    {activeEvent.attendees?.map((a, i) => (
                      <div key={i} className="group relative">
                        <div className={`p-[3px] rounded-full transition-all metal-bg ${a.has_ticket ? 'ring-2 ring-[#00F0FF]' : ''}`}>
                           <img src={a.avatar} className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-[#0e021f] bg-[#0e021f]" />
                           {a.has_ticket && <div className="absolute -top-1 -right-1 bg-[#00F0FF] text-black text-[8px] w-6 h-6 rounded-full flex items-center justify-center font-black ring-2 ring-[#0e021f]">✓</div>}
                        </div>
                        {/* BIOS / STATUS FIXED */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-[#D1FF4B] text-black rounded-xl text-[10px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all z-50 shadow-2xl border border-black/10">
                          {a.name} <br/> <span className="opacity-70 normal-case font-bold">{a.bio || "Just vibe"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/5 shrink-0">
                  {activeEvent.attendees?.some(a => a.name === user.name) ? (
                    <button onClick={() => toggleTicketStatus(activeEvent)} className={`flex-1 py-5 rounded-[25px] font-black uppercase text-xs tracking-widest border-2 transition-all ${activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'bg-[#00F0FF] border-[#00F0FF] text-black' : 'border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/10'}`}>
                       {activeEvent.attendees.find(a => a.name === user.name)?.has_ticket ? 'Ticket Ready ✓' : 'Confirm Ticket'}
                    </button>
                  ) : <button onClick={() => handleJoin(activeEvent)} className="flex-1 bg-[#FF2E95] text-white py-6 rounded-[25px] font-black uppercase tracking-widest shadow-xl">Join Crew</button>}
                  <button onClick={() => handleJoin(activeEvent)} className="bg-white/5 border border-white/10 px-6 py-4 rounded-[25px] font-black uppercase text-[10px] opacity-50 hover:text-red-500">Leave</button>
                </div>
              </div>
            </div>

            {/* Chat Side */}
            <div className="flex-1 flex flex-col bg-[#0b0118] h-full overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                  <span className="font-black uppercase text-xs tracking-[0.4em] text-[#00F0FF]">Feed</span>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {(activeEvent.comments || []).map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.user === user.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-black uppercase opacity-30 mb-1.5 mx-2">{c.user} • {c.time}</span>
                    <div className="flex gap-3 items-end">
                      {c.user !== user.name && <img src={c.avatar} className="w-8 h-8 rounded-full shadow-lg" />}
                      <div className={`p-4 rounded-3xl max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black' : 'bg-white/5 border border-white/10'}`}>
                        <p className="text-[14px] font-bold leading-tight">{c.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-8 bg-white/5 border-t border-white/5 flex gap-2 shrink-0">
                <input className="bg-transparent flex-1 font-bold outline-none text-white text-base" placeholder="Say something..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={ev => ev.key === 'Enter' && postComment(activeEvent)} />
                <button onClick={() => postComment(activeEvent)} className="bg-[#D1FF4B] text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] shadow-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL - BEAUTIFIED */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-2" onClick={() => { setSelectedDay(null); setEditingEventId(null); }}>
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-8 rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-neon" onClick={e => e.stopPropagation()}>
             <h3 className="text-2xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center tracking-widest">{editingEventId ? "✏️ Edit Vibe" : "🚀 New Vibe"}</h3>
             <div className="space-y-4">
               <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                 <button onClick={() => setForm({...form, is_public: false})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${!form.is_public ? 'bg-[#FF2E95] text-white shadow-lg' : 'opacity-40'}`}>Private</button>
                 <button onClick={() => setForm({...form, is_public: true})} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${form.is_public ? 'bg-[#00F0FF] text-black shadow-lg' : 'opacity-40'}`}>Public</button>
               </div>
               <input className="input-premium" placeholder="Event Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-3">
                 <input className="input-premium" placeholder="Website URL" value={form.event_url} onChange={e => setForm({...form, event_url: e.target.value})} />
                 <input className="input-premium" placeholder="Ticket URL" value={form.ticket_url} onChange={e => setForm({...form, ticket_url: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <input className="input-premium" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-premium" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <input className="input-premium" placeholder="Tags (ex: Tech, House, Chill)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
               <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
                  <div><p className="text-[8px] font-black uppercase text-[#00F0FF]">Hour</p><input type="time" className="bg-transparent font-black w-full text-center outline-none text-white text-xl" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></div>
                  <div className="flex flex-col justify-center"><p className="text-[8px] font-black uppercase text-[#00F0FF]">Date</p><p className="font-black text-sm text-[#D1FF4B]">{format(selectedDay, 'dd MMM')}</p></div>
               </div>
               <textarea className="input-premium h-20 resize-none" placeholder="Description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               <input className="input-premium" placeholder="Search GIF..." onChange={e => searchGiphy(e.target.value)} />
               <div className="grid grid-cols-3 gap-2">
                 {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-14 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} />)}
               </div>
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 mt-8 rounded-[25px] uppercase tracking-widest shadow-neon active:scale-95 transition-all">Save Changes</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL - METAL LOOK */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
           <div className="bg-[#1a0b2e] border-2 border-white/20 p-10 rounded-[60px] w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-8">
                <div className="metal-bg p-1 rounded-full ring-2 ring-white/10">
                   <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#1a0b2e]" alt="avatar" />
                </div>
                <div className="w-full space-y-4">
                  <input className="input-premium" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} placeholder="Username" />
                  <textarea className="input-premium h-20 resize-none" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} placeholder="Bio / Status" />
                  <div className="grid grid-cols-2 gap-4">
                    <input className="input-premium" value={user.location} onChange={e => setUser({...user, location: e.target.value})} placeholder="Location" />
                    <input className="input-premium" value={user.instagram} onChange={e => setUser({...user, instagram: e.target.value})} placeholder="Instagram" />
                  </div>
                  <input className="input-premium border-[#1DB954]/20" value={user.spotify} onChange={e => setUser({...user, spotify: e.target.value})} placeholder="Spotify URL" />
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-white text-black font-black py-5 rounded-[25px] uppercase tracking-widest active:scale-95 transition-all">Update</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .metal-bg { background: linear-gradient(135deg, #71717a 0%, #ffffff 50%, #71717a 100%); }
        .shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.2); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .input-premium { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 14px 20px; font-weight: 700; color: white; width: 100%; outline: none; transition: all 0.3s; font-size: 13px; }
      `}</style>
    </div>
  )
}
export default App

