import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import confetti from 'canvas-confetti'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay 
} from 'date-fns'

function App() {
  // --- 1. SYSTEM & CALENDAR STATES ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 
  const [events, setEvents] = useState([]);
  
  // --- 2. USER PROFILE (Roadmap Category 1) ---
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('social-hub-profile')) || { 
    name: "", 
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Math.random()}`,
    bio: "Exploring the Hub ⚡️",
    badges: ["Newcomer"],
    stats: { events: 0, friends: 0 }
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // --- 3. FORM STATES ---
  const [form, setForm] = useState({ title: "", price: "", location: "", link: "", description: "", tags: "", category: "party" });
  const [gifSearch, setGifSearch] = useState("");
  const [selectedGif, setSelectedGif] = useState(null);
  const [gifResults, setGifResults] = useState([]);

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

  // --- 4. CORE ACTIONS ---
  const handleJoin = async (event) => {
    if (!user.name) {
      setIsEditingProfile(true);
      return;
    }
    const participant = { name: user.name, avatar: user.avatar, badge: user.badges[0] };
    const currentAttendees = event.attendees || [];
    const updatedAttendees = [...currentAttendees.filter(a => a.name !== user.name), participant];

    const { error } = await supabase.from('events').update({ attendees: updatedAttendees }).eq('id', event.id);
    if (!error) {
      confetti({ particleCount: 40, spread: 50, colors: ['#D1FF4B', '#FF2E95'] });
      fetchEvents();
    }
  };

  const handleSave = async () => {
    if (form.title.trim() === "") return;
    const { data, error } = await supabase.from('events').insert([{ 
      ...form, date: format(selectedDay, 'yyyy-MM-dd'), gif_url: selectedGif, attendees: [] 
    }]).select();
    if (!error) {
      confetti({ particleCount: 150, spread: 70 });
      setEvents([...events, ...data]);
      setSelectedDay(null);
      setForm({ title: "", price: "", location: "", link: "", description: "", tags: "", category: "party" });
    }
  };

  // --- 5. RENDER HELPERS ---
  const generateAvatar = (name) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${name || 'Guest'}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

  return (
    <div className="min-h-screen bg-[#0b0118] text-white font-sans p-4 md:p-10">
      
      {/* HEADER & PROFILE CARD */}
      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:row justify-between items-center gap-6">
        <h1 className="text-6xl font-black text-[#D1FF4B] italic tracking-tighter italic">
          SOCIAL HUB<span className="text-[#FF2E95]">!</span>
        </h1>

        <div onClick={() => setIsEditingProfile(true)} className="flex items-center gap-4 bg-white/5 p-3 pr-8 rounded-full border border-white/10 hover:bg-white/10 cursor-pointer transition-all border-l-[#D1FF4B] border-l-4">
          <img src={user.avatar} className="w-12 h-12 rounded-full bg-[#1a0b2e]" alt="avatar" />
          <div>
            <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">My Profile</p>
            <p className="font-black text-sm uppercase">{user.name || "Set Username"}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* CALENDAR SECTION */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-8 bg-white/5 p-4 rounded-2xl">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-[#00F0FF] font-black text-xl">◀</button>
            <h2 className="text-2xl font-black uppercase italic tracking-widest text-[#D1FF4B]">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-[#00F0FF] font-black text-xl">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {eachDayOfInterval({ 
              start: startOfWeek(startOfMonth(currentMonth), {weekStartsOn:1}), 
              end: endOfWeek(endOfMonth(currentMonth), {weekStartsOn:1}) 
            }).map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              const isCurrent = isSameMonth(day, currentMonth);
              return (
                <div key={i} onClick={() => isCurrent && setSelectedDay(day)} className={`aspect-square rounded-[25px] p-2 border transition-all ${isCurrent ? 'bg-white/5 border-white/10 cursor-pointer hover:border-[#FF2E95]' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-[10px] font-black opacity-20">{format(day, 'd')}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dayEvents.map(e => <div key={e.id} className="w-1.5 h-1.5 rounded-full bg-[#FF2E95]" />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FEED SECTION */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase text-[#00F0FF] italic tracking-widest">Upcoming Vibes</h3>
          {events.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-[30px] overflow-hidden group hover:border-[#D1FF4B] transition-all">
              {e.gif_url && <img src={e.gif_url} className="w-full h-32 object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="vibe" />}
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-[#FF2E95] uppercase">{format(new Date(e.date), 'MMM dd')}</span>
                  <span className="text-[10px] font-black bg-[#D1FF4B] text-black px-2 py-0.5 rounded shadow-neon">{e.price || 'FREE'}</span>
                </div>
                <h4 className="text-lg font-black uppercase leading-tight mb-1">{e.title}</h4>
                <p className="text-[9px] text-[#00F0FF] font-bold mb-4 opacity-70">📍 {e.location || 'TBA'}</p>
                
                {/* ATTENDEES LIST */}
                <div className="flex -space-x-2 mb-6">
                  {e.attendees?.map((a, idx) => (
                    <img key={idx} src={a.avatar} className="w-8 h-8 rounded-full border-2 border-[#0b0118] bg-[#1a0b2e]" title={a.name} />
                  ))}
                  {(!e.attendees || e.attendees.length === 0) && <p className="text-[9px] uppercase opacity-20 font-black">No one yet</p>}
                </div>

                <button onClick={() => handleJoin(e)} className="w-full bg-white/10 hover:bg-[#FF2E95] py-3 rounded-xl text-[10px] font-black uppercase transition-all">
                  Join the Vibe 🙋‍♂️
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* PROFILE MODAL (Roadmap Category 1) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#D1FF4B] p-10 rounded-[50px] w-full max-w-md shadow-neon-soft">
            <h3 className="text-3xl font-black mb-8 italic text-[#D1FF4B] text-center uppercase">My Identity</h3>
            <div className="flex flex-col items-center gap-6">
              <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-[#FF2E95] bg-[#0b0118]" alt="preview" />
              <input 
                className="input-field w-full" 
                placeholder="What's your name?" 
                value={user.name} 
                onChange={e => setUser({...user, name: e.target.value, avatar: generateAvatar(e.target.value)})} 
              />
              <textarea 
                className="input-field w-full h-24" 
                placeholder="Your Status / Bio" 
                value={user.bio} 
                onChange={e => setUser({...user, bio: e.target.value})} 
              />
              <button onClick={() => setIsEditingProfile(false)} className="w-full bg-[#D1FF4B] text-black font-black py-4 rounded-2xl uppercase tracking-widest text-lg">Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD EVENT MODAL (Simplified) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a0b2e] border-2 border-[#FF2E95] p-8 rounded-[50px] w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black mb-6 text-[#D1FF4B] uppercase italic text-center">{format(selectedDay, 'MMMM dd')} Setup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <input className="input-field" placeholder="Event Name" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <input className="input-field" placeholder="Price (ex: 20$)" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
              <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
              <input className="input-field" placeholder="Ticket Link" value={form.link} onChange={e => setForm({...form, link: e.target.value})} />
              <textarea className="input-field md:col-span-2 h-20" placeholder="Description / Line-up" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            {/* GIF Search would go here as before */}
            <button onClick={handleSave} className="w-full bg-[#FF2E95] text-white font-black py-5 rounded-3xl uppercase tracking-widest shadow-lg">Broadcast Event</button>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-4 text-white/20 text-[10px] font-black uppercase">Cancel</button>
          </div>
        </div>
      )}

      <style>{`
        .input-field { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 15px; font-weight: bold; outline: none; }
        .input-field:focus { border-color: #D1FF4B; }
        .shadow-neon { box-shadow: 0 0 15px rgba(209,255,75,0.4); }
        .shadow-neon-soft { box-shadow: 0 0 40px rgba(209,255,75,0.1); }
      `}</style>
    </div>
  )
}

export default App

