import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isPast
} from 'date-fns'

const GIPHY_API_KEY = "cfJQMO2KVjiYXYBYrTXFdwLHPpGKRFRj";

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});
  const chatEndRef = useRef(null);

  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe Curator ⚡️"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const [form, setForm] = useState({ title: "", price: "", location: "", description: "", recap_url: "" });
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // Leaderboard logic
  const leaderboard = events.reduce((acc, event) => {
      const host = event.attendees?.[0]?.name || "Unknown";
      const hostAvatar = event.attendees?.[0]?.avatar;
      const existing = acc.find(u => u.name === host);
      if (existing) existing.score += (event.hype || 0);
      else acc.push({ name: host, avatar: hostAvatar, score: (event.hype || 0) });
      return acc;
    }, []).sort((a, b) => b.score - a.score).slice(0, 3);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase.channel('harmony-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) setEvents(data);
  }

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    setActiveChatEvent({ ...event, comments: updatedComments });
    setCommentInput("");
    await supabase.from('events').update({ comments: updatedComments, last_comment_at: new Date().toISOString() }).eq('id', event.id);
    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    const eventData = { ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif };
    if (editingEventId) await supabase.from('events').update(eventData).eq('id', editingEventId);
    else await supabase.from('events').insert([{ ...eventData, attendees: [{ name: user.name, avatar: user.avatar }] }]);
    setSelectedDay(null); setEditingEventId(null); setForm({ title: "", price: "", location: "", description: "", recap_url: "" }); setSelectedGif(null);
  };

  const searchGiphy = async (q) => {
    setGifSearch(q); if (q.length < 2) return;
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=6`);
    const { data } = await res.json(); setGifResults(data);
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER & LEADERBOARD */}
      <header className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon mb-4">SOCIAL HUB!</h1>
          <div className="flex gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-[9px] font-black uppercase opacity-40 py-2">Hype Leaders:</span>
            {leaderboard.map((u, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                <img src={u.avatar} className="w-5 h-5 rounded-full" />
                <span className="text-[10px] font-bold">{u.name} {i === 0 ? '👑' : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-2 pr-6 rounded-full flex items-center gap-4 cursor-pointer hover:border-[#FF2E95] transition-all">
          <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" />
          <span className="font-black text-[11px] uppercase tracking-widest">{user.name || "Guest"}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* CALENDAR SECTION */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
            <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[110px] rounded-[25px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95]' : 'opacity-0'}`}>
                  <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-col gap-1 mt-2">{dayEvents.map(e => <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] p-1 rounded uppercase truncate">{e.title}</div>)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED SECTION - FIXED VIEW */}
        <div className="space-y-6">
          {events.map(e => {
            const isPastEvent = isPast(new Date(e.date)) && !isSameDay(new Date(e.date), new Date());
            const unreadCount = (e.comments?.length || 0) - (readComments[e.id] || 0);
            return (
              <div key={e.id} className={`bg-white/5 border-2 rounded-[45px] overflow-hidden relative group transition-all ${isPastEvent ? 'opacity-60 grayscale-[0.3]' : 'border-white/10 hover:border-[#D1FF4B]'}`}>
                {/* Image Logic */}
                <img src={isPastEvent && e.recap_url ? e.recap_url : e.gif_url} className="w-full h-44 object-cover opacity-80 group-hover:opacity-100" />
                
                <div className="p-7">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-xl font-black uppercase tracking-tighter leading-tight">{e.title}</h4>
                    <span className="text-[10px] font-black text-[#00F0FF]">{e.price || 'Free'}</span>
                  </div>
                  
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" className="text-[9px] font-black text-[#D1FF4B] uppercase tracking-widest block mb-4 hover:underline">📍 {e.location}</a>
                  
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex -space-x-3">
                      {e.attendees?.map((a, idx) => <img key={idx} src={a.avatar} className="w-9 h-9 rounded-full border-4 border-[#0b0118] bg-[#1a0b2e]" />)}
                    </div>
                    <button onClick={() => supabase.from('events').update({ hype: (e.hype || 0) + 1 }).eq('id', e.id)} className="flex items-center gap-2 bg-white/5 p-2 px-3 rounded-full hover:bg-[#D1FF4B] hover:text-black transition-all">
                      <span className="text-sm">⚡️</span>
                      <span className="text-[10px] font-black">{e.hype || 0}</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => {}} className="flex-1 bg-[#FF2E95] py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Join Vibe</button>
                    <button onClick={() => {setActiveChatEvent(e); setReadComments(p => ({...p, [e.id]: e.comments?.length || 0}));}} className="relative bg-white/10 p-3.5 rounded-2xl text-xl hover:bg-[#00F0FF] transition-all">
                      💬
                      {unreadCount > 0 && <div className="absolute -top-1 -right-1 bg-[#FF2E95] text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0b0118]">{unreadCount}</div>}
                    </button>
                  </div>
                  {e.attendees?.[0]?.name === user.name && (
                    <button onClick={() => {setEditingEventId(e.id); setSelectedDay(new Date(e.date)); setForm(e); setSelectedGif(e.gif_url);}} className="w-full mt-4 text-[8px] font-black opacity-20 uppercase hover:opacity-100">Edit Settings</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* CHAT MODAL - FIXED UI */}
      {activeChatEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[800] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#00F0FF] p-8 rounded-[60px] w-full max-w-xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase italic text-[#00F0FF]">{activeChatEvent.title}</h3>
              <button onClick={() => setActiveChatEvent(null)} className="text-white/40 font-black text-xs uppercase p-2">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-8 pr-2 custom-scrollbar">
              {(activeChatEvent.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-3 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                  <img src={c.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                  <div className={`p-4 rounded-[25px] max-w-[80%] ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none shadow-[0_10px_20px_rgba(0,240,255,0.2)]' : 'bg-white/5 rounded-tl-none border border-white/10'}`}>
                    <p className="text-[8px] font-black uppercase opacity-60 mb-1">{c.user}</p>
                    <p className="text-sm font-bold leading-tight">{c.text}</p>
                    <p className="text-[7px] text-right mt-2 opacity-40">{c.time}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 bg-white/5 p-2 rounded-[25px] border border-white/10">
              <input className="bg-transparent flex-1 px-4 font-bold outline-none text-sm" placeholder="Send a message..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && postComment(activeChatEvent)} />
              <button onClick={() => postComment(activeChatEvent)} className="bg-[#00F0FF] text-black font-black px-6 py-3 rounded-xl uppercase text-[10px] tracking-widest">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE/EDIT - REINSTATED FIELDS */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[55px] w-full max-w-xl max-h-[90vh] overflow-y-auto">
             <h3 className="text-3xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center">{editingEventId ? "Update Vibe" : "Create New Vibe"}</h3>
             <div className="space-y-5 mb-8">
               <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <input className="input-field" placeholder="Price (ex: 10€, Free)" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                 <input className="input-field" placeholder="Location (Address)" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
               </div>
               <textarea className="input-field h-24 resize-none" placeholder="Short description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               
               <div className="bg-white/5 p-5 rounded-[30px] border border-white/10">
                 <p className="text-[9px] font-black uppercase text-[#00F0FF] mb-4 text-center tracking-widest">Visual Vibe (GIF Search)</p>
                 <input className="input-field mb-4" placeholder="Type a theme (ex: Pool party)" value={gifSearch} onChange={e => searchGiphy(e.target.value)} />
                 <div className="grid grid-cols-3 gap-2">
                   {gifResults.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => setSelectedGif(g.images.fixed_height.url)} className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-all ${selectedGif === g.images.fixed_height.url ? 'border-[#D1FF4B]' : 'border-transparent opacity-40'}`} />)}
                 </div>
               </div>

               {editingEventId && (
                 <div className="bg-[#FF2E95]/10 p-5 rounded-[30px] border border-[#FF2E95]/20">
                   <p className="text-[9px] font-black uppercase text-[#FF2E95] mb-2 text-center tracking-widest">Memory Photo (Post-Event URL)</p>
                   <input className="input-field" placeholder="https://..." value={form.recap_url} onChange={e => setForm({...form, recap_url: e.target.value})} />
                 </div>
               )}
             </div>
             <button onClick={handleSaveEvent} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg shadow-xl hover:scale-95 transition-transform">Broadcast Vibe</button>
             <button onClick={() => {setSelectedDay(null); setEditingEventId(null);}} className="w-full mt-4 text-[10px] opacity-20 uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 z-[900] flex items-center justify-center p-4">
           <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[55px] w-full max-w-sm">
             <div className="flex flex-col items-center gap-8">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#FF2E95]" />
                <input className="input-field text-center font-black uppercase" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.value}`})} />
                <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest">Save Identity</button>
             </div>
           </div>
        </div>
      )}

      <style>{`.input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 18px; font-weight: bold; outline: none; width: 100%; color: white; }.shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }.custom-scrollbar::-webkit-scrollbar { width: 5px; }.custom-scrollbar::-webkit-scrollbar-thumb { background: #00F0FF; border-radius: 10px; }`}</style>
    </div>
  )
}
export default App

