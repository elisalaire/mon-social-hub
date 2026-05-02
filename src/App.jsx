import React, { useState, useEffect } from 'react'
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [readComments, setReadComments] = useState(JSON.parse(localStorage.getItem('read-comments')) || {});

  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Vibe Curator ⚡️"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const [form, setForm] = useState({ title: "", price: "", location: "", description: "" });
  const [gifResults, setGifResults] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    localStorage.setItem('read-comments', JSON.stringify(readComments));
    fetchEvents();

    const channel = supabase
      .channel('mega-hub')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, (payload) => {
        const old = payload.old;
        const now = payload.new;

        // DÉTECTION CHAT : Si la liste des commentaires a grandi
        if (now.comments?.length > (old?.comments?.length || 0)) {
          const lastMsg = now.comments[now.comments.length - 1];
          // On n'envoie pas de notif si c'est nous qui avons écrit
          if (lastMsg.user !== user.name) {
            addNotification(`💬 ${lastMsg.user.toUpperCase()}: "${lastMsg.text.substring(0, 20)}..." sur ${now.title}`);
          }
        }
        
        // DÉTECTION HYPE
        if (now.hype > (old?.hype || 0)) {
          addNotification(`🔥 HYPE: "${now.title}" grimpe en flèche !`);
        }

        fetchEvents();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        addNotification(`🆕 NOUVEL EVENT: ${payload.new.title}`);
        fetchEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [currentMonth, user, readComments]);

  const addNotification = (msg) => {
    setNotifications(prev => [{ id: Date.now(), msg, time: format(new Date(), 'HH:mm') }, ...prev].slice(0, 10));
    setHasUnread(true);
  };

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
    if (data) setEvents(data);
  }

  const openChat = (event) => {
    setActiveChatEvent(event);
    // Marquer comme lu
    setReadComments(prev => ({ ...prev, [event.id]: event.comments?.length || 0 }));
  };

  const postComment = async (event) => {
    if (!commentInput.trim() || !user.name) return;
    const newComment = { user: user.name, avatar: user.avatar, text: commentInput, time: format(new Date(), 'HH:mm') };
    const updatedComments = [...(event.comments || []), newComment];
    
    await supabase.from('events').update({ 
      comments: updatedComments,
      last_comment_at: new Date().toISOString() 
    }).eq('id', event.id);
    
    setCommentInput("");
    setReadComments(prev => ({ ...prev, [event.id]: updatedComments.length }));
  };

  const handleHype = async (event) => {
    await supabase.from('events').update({ hype: (event.hype || 0) + 1 }).eq('id', event.id);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 }, colors: ['#00F0FF', '#FF2E95'] });
  };

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-16 flex justify-between items-center">
        <h1 className="text-5xl font-black text-[#D1FF4B] italic tracking-tighter shadow-neon">SOCIAL HUB!</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={() => { setShowNotifs(!showNotifs); setHasUnread(false); }} className="p-4 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-all">
              <span className="text-xl">🔔</span>
              {hasUnread && <div className="absolute top-0 right-0 w-4 h-4 bg-[#FF2E95] rounded-full border-2 border-[#0b0118] animate-pulse" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-4 w-80 bg-[#1a0b2e] border-2 border-[#D1FF4B] rounded-[35px] p-6 shadow-2xl z-[500]">
                <h4 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest text-center">Live Feed</h4>
                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                  {notifications.map(n => (
                    <div key={n.id} className="text-[11px] font-bold border-b border-white/5 pb-3 leading-tight">
                      <span className="text-[#00F0FF] block mb-1">{n.time}</span> {n.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-2 pr-6 rounded-full flex items-center gap-4 cursor-pointer hover:border-[#FF2E95]">
            <img src={user.avatar} className="w-10 h-10 rounded-full bg-black border border-white/10 shadow-lg" alt="avatar" />
            <span className="font-black text-[11px] uppercase tracking-tighter">{user.name || "Set Identity"}</span>
          </div>
        </div>
      </header>

      {/* FEED PRINCIPAL */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3">
            {/* ... (Calendrier) ... */}
            <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[35px] border border-white/5">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">◀</button>
                <h2 className="text-3xl font-black uppercase italic text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-3xl font-black">▶</button>
            </div>
            <div className="grid grid-cols-7 gap-3">
                {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) }).map((day, i) => {
                const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
                const isCurrent = isSameMonth(day, currentMonth);
                return (
                    <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`min-h-[110px] rounded-[25px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95]' : 'opacity-0'}`}>
                        <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                        <div className="flex flex-col gap-1 mt-2">{dayEvents.map(e => <div key={e.id} className="text-[7px] font-black bg-[#FF2E95] text-white px-2 py-1 rounded-md truncate uppercase">{e.title}</div>)}</div>
                    </div>
                )
                })}
            </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic border-b border-white/10 pb-4 tracking-tighter">Happening Now</h3>
          {events.map(e => {
            const unreadCount = (e.comments?.length || 0) - (readComments[e.id] || 0);
            
            return (
              <div key={e.id} className={`bg-white/5 border-2 rounded-[45px] overflow-hidden relative transition-all ${e.hype > 15 ? 'border-[#D1FF4B] shadow-neon' : 'border-white/10'}`}>
                {e.gif_url && <img src={e.gif_url} className="w-full h-44 object-cover opacity-80" alt="vibe" />}
                
                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="text-2xl font-black uppercase leading-none tracking-tighter">{e.title}</h4>
                    <button onClick={() => handleHype(e)} className="bg-white/10 hover:bg-[#D1FF4B] hover:text-black p-2 px-4 rounded-full flex items-center gap-2 transition-all active:scale-90">
                      <span className="text-xl">⚡️</span>
                      <span className="font-black text-sm">{e.hype || 0}</span>
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => {}} className="flex-1 bg-[#FF2E95] py-4 rounded-[22px] text-[11px] font-black uppercase tracking-widest shadow-lg">Join Vibe</button>
                    
                    {/* BOUTON CHAT AVEC BULLE DE NOTIF */}
                    <button onClick={() => openChat(e)} className="relative bg-white/10 p-4 rounded-[22px] text-2xl hover:bg-[#00F0FF] transition-all">
                      💬
                      {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 bg-[#FF2E95] text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0b0118] animate-bounce">
                          {unreadCount}
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* CHAT MODAL */}
      {activeChatEvent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[800] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#00F0FF] p-8 rounded-[60px] w-full max-w-xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-3xl font-black uppercase italic text-[#00F0FF] leading-none">{activeChatEvent.title}</h3>
                <p className="text-[10px] font-black uppercase opacity-40 mt-2">Vibe Chat Room</p>
              </div>
              <button onClick={() => setActiveChatEvent(null)} className="bg-white/5 p-4 rounded-full hover:bg-red-500 transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-5 mb-8 pr-3 custom-scrollbar">
              {(activeChatEvent.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-4 ${c.user === user.name ? 'flex-row-reverse' : ''}`}>
                  <img src={c.avatar} className="w-10 h-10 rounded-full border-2 border-white/10 shadow-md" />
                  <div className={`p-4 rounded-[25px] max-w-[75%] shadow-xl ${c.user === user.name ? 'bg-[#00F0FF] text-black rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/10'}`}>
                    <p className="text-[9px] font-black uppercase opacity-60 mb-2">{c.user}</p>
                    <p className="text-sm font-bold leading-snug">{c.text}</p>
                    <p className="text-[8px] text-right mt-2 opacity-40 font-black">{c.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 bg-white/5 p-2 rounded-[30px] border border-white/10">
              <input 
                className="bg-transparent flex-1 px-6 font-bold outline-none text-sm" 
                placeholder="Drop a vibe message..." 
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && postComment(activeChatEvent)}
              />
              <button onClick={() => postComment(activeChatEvent)} className="bg-[#00F0FF] text-black font-black p-4 px-8 rounded-[25px] uppercase text-xs tracking-widest hover:scale-95 transition-transform">Send</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.shadow-neon { box-shadow: 0 0 30px rgba(209,255,75,0.3); border-color: #D1FF4B; }.custom-scrollbar::-webkit-scrollbar { width: 5px; }.custom-scrollbar::-webkit-scrollbar-thumb { background: #00F0FF; border-radius: 10px; }`}</style>
    </div>
  )
}
export default App

