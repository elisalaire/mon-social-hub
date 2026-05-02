import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay 
} from 'date-fns'

function App() {
  // --- 1. STATES ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  
  // --- 2. USER PROFILE (Roadmap Category 1) ---
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Exploring the Hub ⚡️",
    insta: "",
    spotify: "",
    badges: ["Newcomer"]
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // --- 3. FORM STATES ---
  const [form, setForm] = useState({ title: "", price: "", location: "", link: "", description: "", tags: "" });
  const [selectedGif, setSelectedGif] = useState(null);

  // --- 4. AUTO-STATS & BADGES ---
  const userStats = {
    hosted: events.filter(e => e.attendees?.[0]?.name === user.name).length,
    joined: events.filter(e => e.attendees?.some(a => a.name === user.name)).length
  };

  const getBadges = () => {
    let b = ["Member"];
    if (userStats.hosted >= 1) b.push("Host");
    if (userStats.hosted >= 3) b.push("Party Starter 🏆");
    if (userStats.joined >= 5) b.push("Socialite 🔥");
    return b;
  };

  useEffect(() => {
    localStorage.setItem('social-hub-profile', JSON.stringify(user));
    fetchEvents();
  }, [currentMonth, user]);

  async function fetchEvents() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('events').select('*').gte('date', start).lte('date', end);
    if (data) setEvents(data);
  }

  // --- 5. ACTIONS ---
  const handleJoin = async (event) => {
    if (!user.name) { setIsEditingProfile(true); return; }
    
    const participant = { 
      name: user.name, 
      avatar: user.avatar, 
      bio: user.bio,
      insta: user.insta,
      badges: getBadges() 
    };

    const currentAttendees = event.attendees || [];
    const isAlreadyIn = currentAttendees.some(a => a.name === user.name);
    const updatedAttendees = isAlreadyIn 
      ? currentAttendees.filter(a => a.name !== user.name) 
      : [...currentAttendees, participant];

    const { error } = await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!error) {
      if (!isAlreadyIn) confetti({ particleCount: 40, spread: 50, colors: ['#D1FF4B', '#FF2E95'] });
      fetchEvents();
    }
  };

  const handleSaveEvent = async () => {
    if (!form.title || !selectedDay) return;
    const { data, error } = await supabase.from('events').insert([{ 
      ...form, 
      date: format(selectedDay, 'yyyy-MM-dd'), 
      gif_url: selectedGif, 
      attendees: [{ name: user.name, avatar: user.avatar, badges: getBadges() }] 
    }]).select();
    
    if (!error) {
      confetti({ particleCount: 150, spread: 70 });
      setEvents([...events, ...data]);
      setSelectedDay(null);
      setForm({ title: "", price: "", location: "", link: "", description: "", tags: "" });
    }
  };

  const generateAvatar = (name) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${name || 'Guest'}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* --- HEADER & PROFILE CARD --- */}
      <header className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h1 className="text-7xl font-black text-[#D1FF4B] italic tracking-tighter mb-4 shadow-neon">
            SOCIAL HUB<span className="text-[#FF2E95]">!</span>
          </h1>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {getBadges().map(b => (
              <span key={b} className="bg-white/10 border border-white/20 text-[8px] font-black px-3 py-1 rounded-full uppercase text-[#00F0FF]">{b}</span>
            ))}
          </div>
        </div>

        <div onClick={() => setIsEditingProfile(true)} className="bg-white/5 border border-white/10 p-5 rounded-[40px] flex items-center gap-6 cursor-pointer hover:bg-white/10 transition-all border-l-4 border-l-[#FF2E95] min-w-[320px] group">
          <div className="relative">
            <img src={user.avatar} className="w-16 h-16 rounded-full bg-[#1a0b2e] border-2 border-[#D1FF4B] group-hover:scale-110 transition-transform animate-pulse-slow" alt="avatar" />
            <div className="absolute -top-2 -right-2 bg-[#FF2E95] text-[10px] font-black px-2 py-0.5 rounded-full">LVL {userStats.joined}</div>
          </div>
          <div>
            <h4 className="font-black text-xl uppercase tracking-tighter">{user.name || "Set Identity"}</h4>
            <p className="text-[10px] text-[#00F0FF] font-bold italic opacity-70">"{user.bio}"</p>
            <div className="flex gap-4 mt-2">
              <span className="text-[9px] font-black opacity-40 uppercase">{userStats.hosted} Events</span>
              <span className="text-[9px] font-black opacity-40 uppercase">{userStats.joined} Joined</span>
              {user.insta && <span className="text-[10px]">📸</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* --- CALENDAR --- */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-6 rounded-[30px] border border-white/5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black hover:scale-125 transition-transform">◀</button>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[#D1FF4B]">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] text-2xl font-black hover:scale-125 transition-transform">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`aspect-square rounded-[28px] p-3 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95] hover:bg-white/10' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[11px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dayEvents.map(e => <div key={e.id} className="w-2 h-2 rounded-full bg-[#FF2E95] shadow-[0_0_8px_#FF2E95]" />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* --- FEED --- */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest border-b border-white/10 pb-4 text-center lg:text-left">Upcoming Vibes</h3>
          {events.length === 0 && <p className="text-center opacity-20 py-10 uppercase font-black text-xs">No events this month</p>}
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-[35px] overflow-hidden group hover:border-[#D1FF4B] transition-all">
              {e.gif_url && <img src={e.gif_url} className="w-full h-40 object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="vibe" />}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] font-black text-[#FF2E95] uppercase tracking-widest">{format(new Date(e.date), 'MMM dd')}</span>
                  <span className="text-[11px] font-black bg-[#D1FF4B] text-black px-3 py-1 rounded-full">{e.price || 'FREE'}</span>
                </div>
                <h4 className="text-xl font-black uppercase leading-tight mb-2 group-hover:text-[#D1FF4B] transition-colors">{e.title}</h4>
                <p className="text-[10px] text-[#00F0FF] font-bold mb-6 opacity-60">📍 {e.location || 'TBA'}</p>
                
                <div className="flex -space-x-3 mb-8 overflow-hidden">
                  {e.attendees?.map((a, idx) => (
                    <img key={idx} src={a.avatar} className="w-10 h-10 rounded-full border-4 border-[#0b0118] bg-[#1a0b2e] hover:z-10 hover:scale-110 transition-transform cursor-help" title={`${a.name}: ${a.bio}`} />
                  ))}
                </div>

                <button onClick={() => handleJoin(e)} className="w-full bg-white/10 hover:bg-[#FF2E95] py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(255,46,149,0.4)]">
                  {e.attendees?.some(a => a.name === user.name) ? 'Leave Vibe' : 'Join the Vibe 🙋‍♂️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* --- PROFILE MODAL --- */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[55px] w-full max-w-md shadow-2xl">
            <h3 className="text-4xl font-black mb-10 italic text-[#D1FF4B] text-center uppercase tracking-tighter">My Identity</h3>
            <div className="flex flex-col items-center gap-6">
              <div className="relative group">
                <img src={user.avatar} className="w-28 h-28 rounded-full border-4 border-[#FF2E95] bg-[#0b0118] transition-transform group-hover:rotate-12" alt="preview" />
                <div className="absolute -bottom-2 -right-2 bg-white text-black p-2 rounded-full text-xs">✨</div>
              </div>
              <input className="input-field w-full" placeholder="Public Display Name" value={user.name} onChange={e => setUser({...user, name: e.target.value, avatar: generateAvatar(e.target.value)})} />
              <input className="input-field w-full" placeholder="Bio / Status (ex: Ready to dance)" value={user.bio} onChange={e => setUser({...user, bio: e.target.value})} />
              <div className="flex gap-4 w-full">
                <input className="input-field w-1/2" placeholder="Insta @user" value={user.insta} onChange={e => setUser({...user, insta: e.target.value})} />
                <input className="input-field w-1/2" placeholder="Spotify ID" value={user.spotify} onChange={e => setUser({...user, spotify: e.target.value})} />
              </div>
              <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-5 rounded-[25px] uppercase tracking-widest text-lg hover:bg-white transition-colors">Save My Identity</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD EVENT MODAL --- */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-10 rounded-[55px] w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-4xl font-black mb-8 text-[#D1FF4B] uppercase italic text-center tracking-tighter">{format(selectedDay, 'MMMM dd')} Setup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <input className="input-field" placeholder="Price (ex: 15$ or Free)" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
              <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
              <input className="input-field" placeholder="Ticket/Info Link" value={form.link} onChange={e => setForm({...form, link: e.target.value})} />
              <textarea className="input-field md:col-span-2 h-24" placeholder="Description & Line-up" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <input className="input-field md:col-span-2" placeholder="Giphy URL for the vibe" value={selectedGif} onChange={e => setSelectedGif(e.target.value)} />
            </div>
            <button onClick={handleSaveEvent} className="w-full bg-[#FF2E95] text-white font-black py-6 rounded-[30px] uppercase tracking-widest text-xl hover:shadow-[0_0_30px_#FF2E95] transition-all">Broadcast Event</button>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-6 text-white/20 text-[11px] font-black uppercase tracking-widest">Nevermind, take me back</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
        .input-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 22px; padding: 18px; font-weight: bold; outline: none; transition: all 0.3s; }
        .input-field:focus { border-color: #D1FF4B; background: rgba(255,255,255,0.07); }
        .shadow-neon { text-shadow: 0 0 20px rgba(209,255,75,0.5); }
      `}</style>
    </div>
  )
}

export default App

