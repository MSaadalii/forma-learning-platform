'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Bookmark, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Compass, FileText, GraduationCap, Layers3, LayoutDashboard, LogOut, Menu, MessageCircle, NotebookPen, Plus, Search, ShieldCheck, Sparkles, Target, Video, X } from 'lucide-react';
import { db, configured } from '@/lib/supabase';
import { DEMO_CREATOR, DEMO_USER, demoCourses, demoLessons, demoPosts, demoQuestions } from '@/lib/demo';
import { LearningHub } from '@/components/learning-hub';
import { CreatorInsights } from '@/components/creator-insights';
import type { Course, CreatorAnalytics, Lesson, Post, Profile, QuizAttempt, QuizQuestion, Role } from '@/lib/types';

type View = 'home' | 'explore' | 'course' | 'lesson' | 'studio' | 'learning' | 'insights';
type LocalState = { courses: Course[]; lessons: Lesson[]; questions: QuizQuestion[]; posts: Post[]; enrollments: string[]; completed: string[]; completedAt: Record<string,string>; bookmarks: string[]; notes: Record<string,string>; goal: number; attempts: QuizAttempt[] };
const STORE_KEY = 'forma-demo-v1';
const initialState: LocalState = { courses: demoCourses, lessons: demoLessons, questions: demoQuestions, posts: demoPosts, enrollments: ['course-design'], completed: [], completedAt: {}, bookmarks: [], notes: {}, goal: 3, attempts: [] };
const categories = ['All subjects', 'Design', 'Data', 'Communication', 'Technology', 'Business', 'Science'];
const colors = ['coral', 'blue', 'green', 'violet'];
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
function parseText(value: string) { return value.split('\n').map((line, i) => line.startsWith('## ') ? <h3 key={i}>{line.slice(3)}</h3> : line.trim() ? <p key={i}>{line}</p> : null); }

export function Workspace() {
  const [view, setView] = useState<View>('home');
  const [demo, setDemo] = useState<LocalState>(initialState);
  const [profile, setProfile] = useState<Profile | null>(configured ? null : DEMO_USER);
  const [authReady, setAuthReady] = useState(!configured);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin'|'signup'>('signup');
  const [authRole, setAuthRole] = useState<Role>('student');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState<Course[]>(configured ? [] : demoCourses);
  const [lessons, setLessons] = useState<Lesson[]>(configured ? [] : demoLessons);
  const [questions, setQuestions] = useState<QuizQuestion[]>(configured ? [] : demoQuestions);
  const [posts, setPosts] = useState<Post[]>(configured ? [] : demoPosts);
  const [enrollments, setEnrollments] = useState<string[]>(configured ? [] : ['course-design']);
  const [completed, setCompleted] = useState<string[]>([]);
  const [completedAt, setCompletedAt] = useState<Record<string,string>>({});
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [noteText, setNoteText] = useState('');
  const [goal, setGoal] = useState(3);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [analytics, setAnalytics] = useState<CreatorAnalytics[]>([]);
  const [courseId, setCourseId] = useState('course-design');
  const [lessonId, setLessonId] = useState('lesson-1');
  const [category, setCategory] = useState('All subjects');
  const [search, setSearch] = useState('');
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string,number>>({});
  const [score, setScore] = useState<number|null>(null);
  const [postText, setPostText] = useState('');
  const [menu, setMenu] = useState(false);
  const [courseDraft, setCourseDraft] = useState({ title: '', subtitle: '', description: '', category: 'Design', level: 'Beginner', color: 'coral' });
  const [lessonDraft, setLessonDraft] = useState({ title: '', summary: '', body: '', media_url: '', media_type: 'none' as Lesson['media_type'], duration_minutes: 10, prompt: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });
  const [studioCourseId, setStudioCourseId] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 4500); };
  const syncDemo = (next: LocalState) => { setDemo(next); try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {} };
  useEffect(() => { if (configured) return; try { const saved = localStorage.getItem(STORE_KEY); if (saved) { const parsed = JSON.parse(saved) as LocalState; if (parsed.courses && parsed.lessons) setDemo({ ...initialState, ...parsed, completedAt: parsed.completedAt || Object.fromEntries((parsed.completed || []).map(id => [id, new Date().toISOString()])) }); } } catch {} }, []);
  useEffect(() => { if (configured) return; setCourses(demo.courses); setLessons(demo.lessons); setQuestions(demo.questions); setPosts(demo.posts); setEnrollments(demo.enrollments); setCompleted(demo.completed); setCompletedAt(demo.completedAt || {}); setBookmarks(demo.bookmarks || []); setNotes(demo.notes || {}); setGoal(demo.goal || 3); setAttempts(demo.attempts || []); }, [demo]);

  const load = useCallback(async (person: Profile | null) => {
    if (!configured) return;
    const api = db();
    const [courseResult, lessonResult] = await Promise.all([
      api.from('courses').select('*, creator:profiles!courses_creator_id_fkey(full_name)').order('created_at', { ascending: false }),
      api.from('lessons').select('*').order('position')
    ]);
    if (courseResult.error || lessonResult.error) { flash(courseResult.error?.message || lessonResult.error?.message || 'Could not load courses.'); return; }
    setCourses((courseResult.data || []) as Course[]);
    setLessons((lessonResult.data || []) as Lesson[]);
    if (person) {
      const [enrolledResult, progressResult, bookmarksResult, notesResult, goalResult, attemptsResult] = await Promise.all([
        api.from('enrollments').select('course_id').eq('student_id', person.id),
        api.from('progress').select('lesson_id,completed_at').eq('student_id', person.id),
        api.from('lesson_bookmarks').select('lesson_id').eq('student_id', person.id),
        api.from('lesson_notes').select('lesson_id,body').eq('student_id', person.id),
        api.from('study_preferences').select('weekly_goal').eq('student_id', person.id).maybeSingle(),
        api.from('quiz_attempts').select('lesson_id,score,created_at').eq('student_id', person.id).order('created_at', { ascending: false }).limit(100)
      ]);
      setEnrollments((enrolledResult.data || []).map(x => x.course_id));
      setCompleted((progressResult.data || []).map(x => x.lesson_id));
      setCompletedAt(Object.fromEntries((progressResult.data || []).map(x => [x.lesson_id, x.completed_at])));
      setBookmarks((bookmarksResult.data || []).map(x => x.lesson_id));
      setNotes(Object.fromEntries((notesResult.data || []).map(x => [x.lesson_id, x.body])));
      setGoal(goalResult.data?.weekly_goal || 3);
      setAttempts((attemptsResult.data || []) as QuizAttempt[]);
      if (person.role === 'creator') {
        const result = await api.rpc('get_creator_analytics');
        setAnalytics((result.data || []) as CreatorAnalytics[]);
      }
    } else { setEnrollments([]); setCompleted([]); setCompletedAt({}); setBookmarks([]); setNotes({}); setAttempts([]); setAnalytics([]); }
  }, []);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const api = db();
    const resolve = async () => {
      const { data: { user } } = await api.auth.getUser();
      if (!alive) return;
      if (!user) { setProfile(null); setAuthReady(true); await load(null); return; }
      const { data, error } = await api.from('profiles').select('*').eq('id', user.id).single();
      if (!alive) return;
      if (error) { setAuthMessage('Your account is being prepared. Please refresh shortly.'); setAuthReady(true); return; }
      const person = data as Profile; setProfile(person); setAuthReady(true); await load(person);
    };
    resolve();
    const { data: { subscription } } = api.auth.onAuthStateChange(() => { window.setTimeout(resolve, 0); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [load]);

  const selectedCourse = courses.find(x => x.id === courseId);
  const selectedLesson = lessons.find(x => x.id === lessonId);
  const courseLessons = lessons.filter(x => x.course_id === courseId).sort((a,b) => a.position-b.position);
  const myCourses = courses.filter(x => profile?.role === 'creator' ? x.creator_id === profile.id : enrollments.includes(x.id));
  const filtered = courses.filter(x => x.published && (category === 'All subjects' || x.category === category) && `${x.title} ${x.subtitle} ${x.category}`.toLowerCase().includes(search.toLowerCase()));
  const doneCount = (id: string) => lessons.filter(x => x.course_id === id && completed.includes(x.id)).length;
  const percent = (id: string) => { const count = lessons.filter(x => x.course_id === id).length; return count ? Math.round(doneCount(id)/count*100) : 0; };
  const lessonQuestions = questions.filter(x => x.lesson_id === lessonId);
  const activeIndex = courseLessons.findIndex(x => x.id === lessonId);
  const nextLesson = courseLessons[activeIndex + 1];
  const canCreate = profile?.role === 'creator';
  const enroll = async (id: string) => {
    if (!profile) { setAuthOpen(true); return; }
    if (enrollments.includes(id)) { openCourse(id); return; }
    if (configured) {
      const { error } = await db().from('enrollments').insert({ course_id: id, student_id: profile.id });
      if (error) return flash(error.message);
      setEnrollments(prev => [...prev, id]);
    } else syncDemo({ ...demo, enrollments: [...demo.enrollments, id] });
    flash('You’re enrolled. Your learning journey starts here.'); openCourse(id);
  };
  const openCourse = (id: string) => { setCourseId(id); setView('course'); setMenu(false); window.scrollTo(0,0); };
  const openLesson = async (id: string) => {
    if (!profile) { setAuthOpen(true); return; }
    const lesson = lessons.find(x => x.id === id);
    if (!lesson) return;
    if (profile.role === 'student' && !enrollments.includes(lesson.course_id)) return flash('Enroll in the course first.');
    setCourseId(lesson.course_id); setLessonId(id); setNoteText(notes[id] || ''); setQuizOpen(false); setScore(null); setAnswers({}); setPosts([]); setQuestions([]); setView('lesson'); window.scrollTo(0,0);
    if (configured) {
      const api = db();
      const [quizResult, postResult] = await Promise.all([
        api.rpc('get_lesson_quiz', { p_lesson_id: id }),
        api.from('discussion_posts').select('id,lesson_id,user_id,body,created_at,author:profiles(full_name)').eq('lesson_id', id).order('created_at', { ascending: false })
      ]);
      if (quizResult.error) flash(quizResult.error.message);
      setQuestions((quizResult.data || []).map((q: QuizQuestion) => ({ ...q, options: q.options })));
      setPosts((postResult.data || []).map(p => ({ id: p.id, lesson_id: p.lesson_id, user_id: p.user_id, body: p.body, created_at: p.created_at, author: Array.isArray(p.author) ? p.author[0]?.full_name || 'Learner' : (p.author as unknown as { full_name: string } | null)?.full_name || 'Learner' })));
    } else { setQuestions(demo.questions); setPosts(demo.posts); }
  };
  const complete = async () => {
    if (!profile || !selectedLesson) return;
    const when = new Date().toISOString();
    if (configured) {
      const { error } = await db().from('progress').upsert({ student_id: profile.id, lesson_id: lessonId, completed_at: completedAt[lessonId] || when }, { onConflict: 'student_id,lesson_id' });
      if (error) return flash(error.message);
      setCompleted(prev => Array.from(new Set([...prev, lessonId])));
      setCompletedAt(prev => ({ ...prev, [lessonId]: prev[lessonId] || when }));
    } else syncDemo({ ...demo, completed: Array.from(new Set([...demo.completed, lessonId])), completedAt: { ...demo.completedAt, [lessonId]: demo.completedAt[lessonId] || when } });
    flash('Lesson completed. Your progress is saved.');
  };
  const submitQuiz = async () => {
    if (!profile || lessonQuestions.length === 0 || lessonQuestions.some(q => answers[q.id] === undefined)) return;
    if (configured) {
      const { data, error } = await db().rpc('submit_lesson_quiz', { p_lesson_id: lessonId, p_answers: answers });
      if (error) return flash(error.message);
      setScore(Number(data)); setAttempts(prev => [{ lesson_id: lessonId, score: Number(data), created_at: new Date().toISOString() }, ...prev]);
    } else {
      const correct = lessonQuestions.filter(q => answers[q.id] === q.correct_index).length;
      const value = Math.round(correct / lessonQuestions.length * 100);
      setScore(value);
      syncDemo({ ...demo, attempts: [{ lesson_id: lessonId, score: value, created_at: new Date().toISOString() }, ...(demo.attempts || [])] });
    }
  };
  const toggleBookmark = async () => {
    if (!profile || profile.role !== 'student') return;
    const isSaved = bookmarks.includes(lessonId);
    if (configured) {
      const query = db().from('lesson_bookmarks');
      const { error } = isSaved ? await query.delete().eq('student_id', profile.id).eq('lesson_id', lessonId) : await query.insert({ student_id: profile.id, lesson_id: lessonId });
      if (error) return flash(error.message);
      setBookmarks(prev => isSaved ? prev.filter(id => id !== lessonId) : [...prev, lessonId]);
    } else syncDemo({ ...demo, bookmarks: isSaved ? (demo.bookmarks || []).filter(id => id !== lessonId) : [...(demo.bookmarks || []), lessonId] });
    flash(isSaved ? 'Removed from saved lessons.' : 'Saved to your learning hub.');
  };
  const saveNote = async () => {
    if (!profile || profile.role !== 'student' || noteText.length > 10000) return;
    if (configured) {
      const { error } = await db().from('lesson_notes').upsert({ student_id: profile.id, lesson_id: lessonId, body: noteText, updated_at: new Date().toISOString() }, { onConflict: 'student_id,lesson_id' });
      if (error) return flash(error.message);
      setNotes(prev => ({ ...prev, [lessonId]: noteText }));
    } else syncDemo({ ...demo, notes: { ...(demo.notes || {}), [lessonId]: noteText } });
    flash('Your private note is saved.');
  };
  const changeGoal = async (value: number) => {
    if (!profile || profile.role !== 'student') return;
    if (configured) {
      const { error } = await db().from('study_preferences').upsert({ student_id: profile.id, weekly_goal: value }, { onConflict: 'student_id' });
      if (error) return flash(error.message);
      setGoal(value);
    } else syncDemo({ ...demo, goal: value });
    flash('Your weekly goal is updated.');
  };
  const sendPost = async () => {
    if (!profile || !postText.trim() || postText.length > 2000) return;
    const body = postText.trim();
    if (configured) {
      const { data, error } = await db().from('discussion_posts').insert({ lesson_id: lessonId, user_id: profile.id, body }).select('*').single();
      if (error) return flash(error.message);
      setPosts(prev => [{ ...(data as Post), author: profile.full_name }, ...prev]);
    } else syncDemo({ ...demo, posts: [{ id: uid(), lesson_id: lessonId, user_id: profile.id, body, author: profile.full_name, created_at: new Date().toISOString() }, ...demo.posts] });
    setPostText('');
  };
  const createCourse = async () => {
    if (!profile || !canCreate || !courseDraft.title.trim() || !courseDraft.description.trim()) return flash('Add a title and description first.');
    const item: Course = { id: uid(), creator_id: profile.id, ...courseDraft, published: false, creator: { full_name: profile.full_name } };
    if (configured) {
      const { data, error } = await db().from('courses').insert({ creator_id: profile.id, title: courseDraft.title.trim(), subtitle: courseDraft.subtitle.trim(), description: courseDraft.description.trim(), category: courseDraft.category, level: courseDraft.level, color: courseDraft.color, published: false }).select('*').single();
      if (error) return flash(error.message);
      item.id = data.id;
    } else syncDemo({ ...demo, courses: [item, ...demo.courses] });
    setCourses(prev => [item, ...prev]); setStudioCourseId(item.id); setCourseDraft({ title: '', subtitle: '', description: '', category: 'Design', level: 'Beginner', color: 'coral' }); flash('Course draft created. Add your first lesson below.');
  };
  const editLesson = (lesson: Lesson) => {
    setStudioCourseId(lesson.course_id); setEditingLessonId(lesson.id); setLessonDraft({ title: lesson.title, summary: lesson.summary, body: lesson.body, media_url: lesson.media_url || '', media_type: lesson.media_type, duration_minutes: lesson.duration_minutes, prompt: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });
    document.getElementById('lesson-editor')?.scrollIntoView({ behavior: 'smooth' });
  };
  const createLesson = async () => {
    if (!profile || !canCreate || !studioCourseId || !lessonDraft.title.trim() || !lessonDraft.body.trim()) return flash('Add a lesson title and content first.');
    if (lessonDraft.media_type !== 'none' && lessonDraft.media_url && !/^https:\/\//i.test(lessonDraft.media_url)) return flash('Media URL must start with https://');
    if (lessonDraft.prompt.trim() && lessonDraft.options.some(x => !x.trim())) return flash('Fill all four quiz options before saving the lesson.');
    if (editingLessonId) {
      const updates = { title: lessonDraft.title.trim(), summary: lessonDraft.summary.trim(), body: lessonDraft.body.trim(), media_url: lessonDraft.media_url.trim() || null, media_type: lessonDraft.media_type, duration_minutes: Number(lessonDraft.duration_minutes) || 10 };
      if (configured) { const { error } = await db().from('lessons').update(updates).eq('id', editingLessonId); if (error) return flash(error.message); }
      else syncDemo({ ...demo, lessons: demo.lessons.map(x => x.id === editingLessonId ? { ...x, ...updates } : x) });
      setLessons(prev => prev.map(x => x.id === editingLessonId ? { ...x, ...updates } : x)); setEditingLessonId(null);
      setLessonDraft({ title: '', summary: '', body: '', media_url: '', media_type: 'none', duration_minutes: 10, prompt: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });
      return flash('Lesson updated. Changes are live in the course.');
    }
    const position = lessons.filter(x => x.course_id === studioCourseId).length + 1;
    const item: Lesson = { id: uid(), course_id: studioCourseId, title: lessonDraft.title.trim(), summary: lessonDraft.summary.trim(), body: lessonDraft.body.trim(), media_url: lessonDraft.media_url.trim() || null, media_type: lessonDraft.media_type, duration_minutes: Number(lessonDraft.duration_minutes) || 10, position };
    if (configured) {
      const { data, error } = await db().from('lessons').insert({ course_id: studioCourseId, title: item.title, summary: item.summary, body: item.body, media_url: item.media_url, media_type: item.media_type, duration_minutes: item.duration_minutes, position }).select('*').single();
      if (error) return flash(error.message);
      item.id = data.id;
    }
    let quiz: QuizQuestion | null = null;
    if (lessonDraft.prompt.trim()) {
      quiz = { id: uid(), lesson_id: item.id, prompt: lessonDraft.prompt.trim(), options: lessonDraft.options.map(x => x.trim()), correct_index: lessonDraft.correct_index, explanation: lessonDraft.explanation.trim() };
      if (configured) {
        const { data, error } = await db().from('quiz_questions').insert({ lesson_id: item.id, prompt: quiz.prompt, options: quiz.options, correct_index: quiz.correct_index, explanation: quiz.explanation }).select('id').single();
        if (error) flash(`Lesson saved, but quiz needs attention: ${error.message}`); else quiz.id = data.id;
      }
    }
    if (!configured) syncDemo({ ...demo, lessons: [...demo.lessons, item], questions: quiz ? [...demo.questions, quiz] : demo.questions });
    setLessons(prev => [...prev, item]); if (quiz) setQuestions(prev => [...prev, quiz]);
    setLessonDraft({ title: '', summary: '', body: '', media_url: '', media_type: 'none', duration_minutes: 10, prompt: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });
    flash('Lesson added. You can continue building your course.');
  };
  const publish = async (id: string) => {
    if (!lessons.some(x => x.course_id === id)) return flash('Add at least one lesson before publishing.');
    if (configured) { const { error } = await db().from('courses').update({ published: true }).eq('id', id).eq('creator_id', profile!.id); if (error) return flash(error.message); }
    else syncDemo({ ...demo, courses: demo.courses.map(x => x.id === id ? { ...x, published: true } : x) });
    setCourses(prev => prev.map(x => x.id === id ? { ...x, published: true } : x)); flash('Course published. Learners can now discover it.');
  };
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setAuthMessage('');
    const api = db();
    if (authMode === 'signup') {
      const { data, error } = await api.auth.signUp({ email: authEmail.trim(), password: authPassword, options: { data: { full_name: authName.trim(), role: authRole } } });
      setAuthMessage(error?.message || (data.session ? 'Account created. Welcome to Forma!' : 'Check your email for a confirmation link, then sign in.'));
      if (!error && data.session) setAuthOpen(false);
    } else {
      const { error } = await api.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
      setAuthMessage(error?.message || 'Welcome back!'); if (!error) setAuthOpen(false);
    }
    setBusy(false);
  };
  const signOut = async () => { if (configured) { await db().auth.signOut(); setProfile(null); } else setProfile(DEMO_USER); setView('home'); };
  const go = (target: View) => { setView(target); setMenu(false); window.scrollTo(0,0); };
  const switchDemoRole = () => { setProfile(profile?.role === 'creator' ? DEMO_USER : DEMO_CREATOR); go('home'); };

  if (!authReady) return <main className="loading"><div className="brandmark">f<span>.</span></div><p>Preparing your learning space…</p></main>;
  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => go('home')} aria-label="Forma home"><span className="brandmark">f<span>.</span></span><span>forma</span></button>
      <p className="nav-label">YOUR SPACE</p>
      <nav aria-label="Main navigation">
        <button className={view === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => go('home')}><LayoutDashboard size={19}/> Overview</button>
        <button className={view === 'explore' ? 'nav-item active' : 'nav-item'} onClick={() => go('explore')}><Compass size={19}/> Explore courses</button>
        {canCreate ? <><button className={view === 'studio' ? 'nav-item active' : 'nav-item'} onClick={() => go('studio')}><Layers3 size={19}/> Creator studio</button><button className={view === 'insights' ? 'nav-item active' : 'nav-item'} onClick={() => go('insights')}><Target size={19}/> Insights</button></> : <button className={view === 'learning' ? 'nav-item active' : 'nav-item'} onClick={() => go('learning')}><BookOpen size={19}/> My learning</button>}
      </nav>
      <p className="nav-label nav-label-second">MY LEARNING</p>
      <div className="sidebar-courses">{myCourses.slice(0, 4).map(c => <button key={c.id} className="sidebar-course" onClick={() => openCourse(c.id)}><span className={`mini-art ${c.color}`}>{c.title.slice(0,1)}</span><span className="sidebar-course-name">{c.title}<small>{canCreate ? c.published ? 'Published' : 'Draft' : `${percent(c.id)}% complete`}</small></span></button>)}{myCourses.length === 0 && <p className="side-empty">Your courses will appear here.</p>}</div>
      <div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={18}/><strong>Learn a little.<br/>Go a long way.</strong><p>Make progress one thoughtful lesson at a time.</p></div>
      <button className="account" onClick={configured ? (profile ? signOut : () => setAuthOpen(true)) : switchDemoRole}><span className="avatar">{profile?.full_name?.slice(0,1) || '?'}</span><span><strong>{profile?.full_name || 'Join Forma'}</strong><small>{configured ? profile ? `${profile.role} · sign out` : 'Sign in or create account' : `Demo ${profile?.role} · switch role`}</small></span>{configured && profile ? <LogOut size={17}/> : <ChevronRight size={17}/>}</button></div>
    </aside>
    <div className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X/> : <Menu/>}</button><div className="breadcrumb">Learning space <ChevronRight size={14}/> <strong>{view === 'home' ? 'Overview' : view === 'explore' ? 'Explore' : view === 'studio' ? 'Creator studio' : view === 'insights' ? 'Insights' : view === 'learning' ? 'My learning' : view === 'course' ? selectedCourse?.title : selectedLesson?.title}</strong></div><div className="top-actions">{!configured && <span className="demo-pill"><span/> LOCAL DEMO</span>}{configured && !profile && <button className="small-btn" onClick={() => setAuthOpen(true)}>Sign in <ArrowRight size={15}/></button>}<button className="top-avatar" aria-label="Account" onClick={configured ? () => setAuthOpen(true) : switchDemoRole}>{profile?.full_name?.slice(0,1) || '?'}</button></div></header>
    <main className="content">
      {view === 'home' && <><section className="welcome"><div><p className="eyebrow">THE LEARNING SPACE <span className="line"/></p><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},<br/><em>{profile?.full_name?.split(' ')[0] || 'curious mind'}.</em></h1><p>Keep your curiosity moving. Pick up where you left off, or discover something worth learning.</p><button className="dark-button" onClick={() => go(canCreate ? 'studio' : 'explore')}>{canCreate ? 'Open creator studio' : 'Explore courses'} <ArrowRight size={18}/></button></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="book-shape"><div className="book-left"><span/><span/><span/></div><div className="book-right"><span/><span/><span/></div></div><span className="spark spark-one">✳</span><span className="spark spark-two">✦</span><span className="art-caption">A little more, every day.</span></div></section>
      {profile?.role === 'student' && <button className="home-goal" onClick={() => go('learning')}><span className="home-goal-icon"><Target size={21}/></span><span><strong>Keep your weekly rhythm</strong><small>{Object.values(completedAt).filter(date => { const monday = new Date(); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7); return new Date(date) >= monday; }).length} of {goal} lessons completed this week · view your learning hub</small></span><ArrowRight size={18}/></button>}
      <div className="section-heading"><div><p className="eyebrow muted">YOUR JOURNEY</p><h2>{canCreate ? 'Courses you’re shaping' : 'Continue learning'}</h2></div><button className="text-link" onClick={() => go(canCreate ? 'studio' : 'explore')}>{canCreate ? 'Manage courses' : 'Browse all courses'} <ArrowRight size={16}/></button></div>
      {myCourses.length ? <div className="course-grid">{myCourses.map(c => <CourseCard key={c.id} course={c} progress={percent(c.id)} count={lessons.filter(l => l.course_id === c.id).length || c.lesson_count || 0} onClick={() => openCourse(c.id)} enrolled={true} />)}</div> : <div className="empty-state"><BookOpen size={30}/><h3>{canCreate ? 'Your first course starts here' : 'Your journey starts here'}</h3><p>{canCreate ? 'Create a course and share what you know.' : 'Find a course that sparks your curiosity.'}</p><button className="small-btn" onClick={() => go(canCreate ? 'studio' : 'explore')}>{canCreate ? 'Create a course' : 'Explore courses'} <ArrowRight size={16}/></button></div>}
      <div className="section-heading lower"><div><p className="eyebrow muted">A LITTLE INSPIRATION</p><h2>Something new for you</h2></div></div><div className="recommend-grid"><div className="quote-card"><span className="asterisk">✳</span><p>“The beautiful thing about learning is that nobody can take it away from you.”</p><small>— B. B. King</small></div><div className="discovery-card"><div className="disc-icon"><Compass size={22}/></div><div><p className="eyebrow muted">EXPLORE AT YOUR PACE</p><h3>New paths are waiting.</h3><p>Explore practical courses designed for learning that sticks.</p><button className="text-link" onClick={() => go('explore')}>See what’s available <ArrowRight size={16}/></button></div></div></div></>}
      {view === 'learning' && profile?.role === 'student' && <LearningHub courses={courses} lessons={lessons} enrollments={enrollments} completed={completed} completedAt={completedAt} bookmarks={bookmarks} notes={notes} attempts={attempts} goal={goal} onGoal={changeGoal} onLesson={openLesson} onCourse={openCourse} onExplore={() => go('explore')} />}
      {view === 'insights' && canCreate && <CreatorInsights courses={myCourses} lessons={lessons} analytics={configured ? analytics : myCourses.map(c => ({ course_id: c.id, enrolled_count: c.id === 'course-design' ? 128 : c.id === 'course-data' ? 64 : 0, completion_count: c.id === 'course-design' ? 91 : 0, attempt_count: c.id === 'course-design' ? 236 : 0, average_score: c.id === 'course-design' ? 78 : null }))} demo={!configured} onCourse={openCourse} onStudio={() => go('studio')} />}
      {view === 'explore' && <><div className="page-heading"><p className="eyebrow muted">FIND YOUR NEXT SPARK</p><h1>Explore what<br/><em>moves you.</em></h1><p>Thoughtful courses, made for curious people. Choose a subject and begin.</p></div><div className="explore-controls"><label className="searchbox"><Search size={19}/><input aria-label="Search courses" placeholder="Search courses or topics" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="category-strip" aria-label="Filter by subject">{categories.map(x => <button key={x} className={category === x ? 'chip selected' : 'chip'} onClick={() => setCategory(x)}>{x}</button>)}</div></div><div className="results-count">{filtered.length} {filtered.length === 1 ? 'course' : 'courses'} to discover</div><div className="course-grid">{filtered.map(c => <CourseCard key={c.id} course={c} count={lessons.filter(l => l.course_id === c.id).length || c.lesson_count || 0} progress={percent(c.id)} enrolled={enrollments.includes(c.id)} onClick={() => openCourse(c.id)}/>)}</div>{!filtered.length && <div className="empty-state"><Search size={30}/><h3>No matches yet</h3><p>Try another topic or choose “All subjects”.</p></div>}</>}
      {view === 'course' && selectedCourse && <><button className="back-link" onClick={() => go('explore')}><ArrowLeft size={17}/> Back to courses</button><section className={`course-hero ${selectedCourse.color}`}><div className="hero-copy"><p className="eyebrow">{selectedCourse.category.toUpperCase()} <span className="dot-divider">·</span> {selectedCourse.level.toUpperCase()}</p><h1>{selectedCourse.title}</h1><p>{selectedCourse.subtitle}</p><div className="hero-meta"><span><BookOpen size={17}/> {courseLessons.length || selectedCourse.lesson_count || 0} lessons</span><span><Clock3 size={17}/> {courseLessons.reduce((s,l) => s+l.duration_minutes,0) || 45} min</span><span><GraduationCap size={17}/> By {selectedCourse.creator?.full_name || 'Forma creator'}</span></div></div><div className="hero-glyph" aria-hidden="true"><span>✳</span></div></section><div className="course-layout"><div className="course-main"><p className="eyebrow muted">ABOUT THE COURSE</p><h2>What you’ll learn</h2><p className="course-description">{selectedCourse.description}</p><div className="section-heading outline-heading"><div><p className="eyebrow muted">YOUR PATH</p><h2>Course outline</h2></div><span className="outline-count">{courseLessons.length} lessons</span></div><div className="lesson-list">{courseLessons.map((lesson,i) => <button className="lesson-row" key={lesson.id} onClick={() => profile?.role === 'creator' || enrollments.includes(courseId) ? openLesson(lesson.id) : enroll(courseId)}><span className={completed.includes(lesson.id) ? 'lesson-number done' : 'lesson-number'}>{completed.includes(lesson.id) ? <Check size={18}/> : String(i+1).padStart(2,'0')}</span><span className="lesson-row-text"><strong>{lesson.title}</strong><small>{lesson.summary || 'A new step in your learning journey'}</small></span><span className="row-duration">{lesson.duration_minutes} min</span><ArrowRight size={18}/></button>)}{!courseLessons.length && <div className="empty-state compact">No lessons yet. The creator is preparing this course.</div>}</div></div><aside className="course-side"><div className="enroll-card"><div className={`enroll-art ${selectedCourse.color}`}><span>✳</span></div>{enrollments.includes(courseId) ? <><p className="eyebrow muted">YOUR PROGRESS</p><h3>{percent(courseId)}% complete</h3><div className="progress-track"><span style={{width: `${percent(courseId)}%`}}/></div><p>{doneCount(courseId)} of {courseLessons.length} lessons finished</p><button className="dark-button full" onClick={() => courseLessons.length && openLesson(courseLessons.find(l => !completed.includes(l.id))?.id || courseLessons[0].id)}>Continue learning <ArrowRight size={17}/></button></> : <><h3>Ready when you are.</h3><p>Join this course and learn at your own pace. Your progress saves as you go.</p><button className="dark-button full" onClick={() => enroll(courseId)}>Enroll for free <ArrowRight size={17}/></button></>}<div className="enroll-benefits"><span><CheckCircle2 size={17}/> Learn at your pace</span><span><CheckCircle2 size={17}/> Practice what you learn</span><span><CheckCircle2 size={17}/> Track your progress</span></div></div></aside></div></>}
      {view === 'lesson' && selectedLesson && selectedCourse && <><button className="back-link" onClick={() => openCourse(courseId)}><ArrowLeft size={17}/> Back to {selectedCourse.title}</button><div className="lesson-layout"><article className="lesson-article"><div className="lesson-header"><p className="eyebrow muted">LESSON {activeIndex + 1} OF {courseLessons.length} <span className="dot-divider">·</span> {selectedLesson.duration_minutes} MIN READ</p><h1>{selectedLesson.title}</h1><p>{selectedLesson.summary}</p>{profile?.role === 'student' && <button className={bookmarks.includes(lessonId) ? 'bookmark-btn saved' : 'bookmark-btn'} onClick={toggleBookmark}><Bookmark size={16} fill={bookmarks.includes(lessonId) ? 'currentColor' : 'none'}/>{bookmarks.includes(lessonId) ? 'Saved to your library' : 'Save this lesson'}</button>}</div>{selectedLesson.media_url && <div className="media-block"><div className="media-icon">{selectedLesson.media_type === 'video' ? <Video/> : selectedLesson.media_type === 'audio' ? <AudioLines/> : <FileText/>}</div><div><strong>{selectedLesson.media_type === 'video' ? 'Watch the lesson' : selectedLesson.media_type === 'audio' ? 'Listen along' : 'Explore the resource'}</strong><p>Course resource · opens in a new tab</p></div><a href={selectedLesson.media_url} target="_blank" rel="noopener noreferrer" className="small-btn">Open resource <ArrowRight size={16}/></a></div>}<div className="lesson-body">{parseText(selectedLesson.body)}</div>
      {profile?.role === 'student' && <div className="lesson-notes"><div className="notes-title"><NotebookPen size={20}/><div><p className="eyebrow muted">JUST FOR YOU</p><h2>My notes</h2></div></div><p>Capture an idea, question or example. Only you can see these notes.</p><label className="sr-only" htmlFor="lesson-note">Private lesson note</label><textarea id="lesson-note" maxLength={10000} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What do you want to remember?"/><div className="notes-actions"><small>{noteText.length} / 10,000 characters</small><button className="small-btn" disabled={noteText === (notes[lessonId] || '')} onClick={saveNote}>Save note <Check size={16}/></button></div></div>}
      <div className="practice-box"><div className="practice-icon"><Sparkles size={24}/></div><div><p className="eyebrow">MAKE IT STICK</p><h2>Ready to check your understanding?</h2><p>A quick reflection helps turn information into something you can use.</p></div>{profile?.role === 'creator' ? <span className="quiet">Creator preview · learners complete this step.</span> : lessonQuestions.length ? <button className="dark-button" onClick={() => {setQuizOpen(true); setScore(null);}}>Try practice <ArrowRight size={17}/></button> : <button className="dark-button" onClick={complete}>{completed.includes(lessonId) ? 'Completed' : 'Mark complete'} <Check size={17}/></button>}</div>
      {quizOpen && <div className="quiz-panel" id="practice"><div className="section-heading"><div><p className="eyebrow muted">QUICK PRACTICE</p><h2>What did you take away?</h2></div><button className="icon-btn" aria-label="Close practice" onClick={() => setQuizOpen(false)}><X size={20}/></button></div>{lessonQuestions.map((q,i) => <div className="question" key={q.id}><h3><span>{String(i+1).padStart(2,'0')}</span>{q.prompt}</h3><div className="option-list">{q.options.map((opt,index) => <button disabled={score !== null} key={index} className={answers[q.id] === index ? 'option chosen' : 'option'} onClick={() => setAnswers(prev => ({...prev,[q.id]:index}))}><span className="option-radio"/>{opt}</button>)}</div></div>)}{score === null ? <button className="dark-button" disabled={lessonQuestions.some(q => answers[q.id] === undefined)} onClick={submitQuiz}>Check answers <ArrowRight size={17}/></button> : <div className={score >= 70 ? 'feedback success' : 'feedback'}><strong>{score >= 70 ? `Nice work — ${score}%` : `Keep going — ${score}%`}</strong><p>{score >= 70 ? 'You’re ready for the next step. Mark this lesson complete and keep moving.' : 'Review the key ideas above, then try again. Learning takes practice.'}</p><div className="feedback-actions">{score >= 70 ? <button className="small-btn" onClick={complete}>Mark complete <Check size={16}/></button> : <button className="small-btn" onClick={() => { setAnswers({}); setScore(null); }}>Try again <ArrowRight size={16}/></button>}</div></div>}</div>}
      <div className="discussion"><div className="section-heading"><div><p className="eyebrow muted">LEARN TOGETHER</p><h2>Conversation</h2></div><MessageCircle size={22}/></div><p>Share a thought or ask a question about this lesson.</p><label className="sr-only" htmlFor="post">Your comment</label><textarea id="post" maxLength={2000} placeholder="What stood out to you?" value={postText} onChange={e => setPostText(e.target.value)}/><button className="small-btn" disabled={!postText.trim()} onClick={sendPost}>Post comment <ArrowRight size={16}/></button><div className="post-list">{posts.filter(x => x.lesson_id === lessonId).map(p => <div className="post" key={p.id}><span className="avatar small">{(p.author || 'L').slice(0,1)}</span><div><strong>{p.author || 'Learner'}</strong><small>{new Date(p.created_at).toLocaleDateString()}</small><p>{p.body}</p></div></div>)}{!posts.some(x => x.lesson_id === lessonId) && <p className="quiet">Start the conversation.</p>}</div></div>
      <div className="lesson-footer">{nextLesson ? <button onClick={() => openLesson(nextLesson.id)}>Up next <strong>{nextLesson.title}</strong><ArrowRight size={20}/></button> : <button onClick={() => openCourse(courseId)}>You’ve reached the end <strong>Back to course</strong><ArrowRight size={20}/></button>}</div></article><aside className="lesson-aside"><div className="outline-panel"><p className="eyebrow muted">IN THIS COURSE</p><h3>{selectedCourse.title}</h3><div className="progress-track"><span style={{width: `${percent(courseId)}%`}}/></div><small>{percent(courseId)}% complete</small><div className="outline-list">{courseLessons.map((l,i) => <button className={l.id === lessonId ? 'outline-item current' : 'outline-item'} key={l.id} onClick={() => openLesson(l.id)}><span>{completed.includes(l.id) ? <Check size={16}/> : String(i+1).padStart(2,'0')}</span>{l.title}</button>)}</div></div></aside></div></>}
      {view === 'studio' && canCreate && <><div className="page-heading studio-heading"><p className="eyebrow muted">CREATOR STUDIO</p><h1>Make learning<br/><em>worth sharing.</em></h1><p>Build a course, publish a thoughtful lesson, and help someone grow.</p></div><div className="studio-layout"><div><div className="studio-panel"><div className="section-heading"><div><p className="eyebrow muted">01 / START HERE</p><h2>Create a course</h2></div><span className="step-icon"><Plus size={22}/></span></div><div className="form-grid"><label className="span-2">Course title<input value={courseDraft.title} maxLength={90} onChange={e => setCourseDraft({...courseDraft,title:e.target.value})} placeholder="e.g. The art of clear thinking"/></label><label className="span-2">One-line introduction<input value={courseDraft.subtitle} maxLength={150} onChange={e => setCourseDraft({...courseDraft,subtitle:e.target.value})} placeholder="What will people learn?"/></label><label className="span-2">Course description<textarea rows={4} value={courseDraft.description} onChange={e => setCourseDraft({...courseDraft,description:e.target.value})} placeholder="Describe the change a learner can expect…"/></label><label>Subject<select value={courseDraft.category} onChange={e => setCourseDraft({...courseDraft,category:e.target.value})}>{categories.slice(1).map(x => <option key={x}>{x}</option>)}</select></label><label>Level<select value={courseDraft.level} onChange={e => setCourseDraft({...courseDraft,level:e.target.value})}>{['Beginner','Intermediate','Advanced'].map(x => <option key={x}>{x}</option>)}</select></label></div><div className="color-choices"><span>Course color</span>{colors.map(x => <button key={x} className={`color-choice ${x} ${courseDraft.color === x ? 'chosen' : ''}`} aria-label={`${x} color`} onClick={() => setCourseDraft({...courseDraft,color:x})}>{courseDraft.color === x && <Check size={16}/>}</button>)}</div><button className="dark-button" onClick={createCourse}>Create draft <ArrowRight size={17}/></button></div>
      <div className="studio-panel" id="lesson-editor"><div className="section-heading"><div><p className="eyebrow muted">02 / ADD KNOWLEDGE</p><h2>{editingLessonId ? 'Edit a lesson' : 'Build a lesson'}</h2></div><span className="step-icon"><BookOpen size={22}/></span></div><div className="form-grid"><label className="span-2">Choose a course<select value={studioCourseId} onChange={e => { setStudioCourseId(e.target.value); setEditingLessonId(null); }}><option value="">Select a course</option>{courses.filter(x => x.creator_id === profile.id).map(x => <option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label className="span-2">Lesson title<input value={lessonDraft.title} onChange={e => setLessonDraft({...lessonDraft,title:e.target.value})} placeholder="Give this step a name"/></label><label className="span-2">Short summary<input value={lessonDraft.summary} onChange={e => setLessonDraft({...lessonDraft,summary:e.target.value})} placeholder="What is the key takeaway?"/></label><label className="span-2">Lesson content <small>Use ## for headings. Separate paragraphs with a blank line.</small><textarea rows={9} value={lessonDraft.body} onChange={e => setLessonDraft({...lessonDraft,body:e.target.value})} placeholder={'## The key idea\n\nExplain it in your own words…'}/></label><label>Resource type<select value={lessonDraft.media_type} onChange={e => setLessonDraft({...lessonDraft,media_type:e.target.value as Lesson['media_type']})}><option value="none">No media</option><option value="video">Video link</option><option value="audio">Audio link</option><option value="link">Article or interactive resource</option></select></label><label>Estimated minutes<input type="number" min="1" max="240" value={lessonDraft.duration_minutes} onChange={e => setLessonDraft({...lessonDraft,duration_minutes:Number(e.target.value)})}/></label>{lessonDraft.media_type !== 'none' && <label className="span-2">Secure resource URL<input type="url" value={lessonDraft.media_url} onChange={e => setLessonDraft({...lessonDraft,media_url:e.target.value})} placeholder="https://…"/></label>}</div>{!editingLessonId && <div className="quiz-editor"><div><CircleHelp size={20}/><strong>Optional knowledge check</strong></div><label>Question<input value={lessonDraft.prompt} onChange={e => setLessonDraft({...lessonDraft,prompt:e.target.value})} placeholder="Ask one clear question"/></label>{lessonDraft.prompt.trim() && <><div className="option-editor">{lessonDraft.options.map((option,i) => <label key={i}><input type="radio" name="correct-answer" checked={lessonDraft.correct_index === i} onChange={() => setLessonDraft({...lessonDraft,correct_index:i})} aria-label={`Mark option ${i+1} correct`}/><input value={option} onChange={e => setLessonDraft({...lessonDraft,options:lessonDraft.options.map((v,k) => k === i ? e.target.value : v)})} placeholder={`Option ${i+1}`}/></label>)}</div><label>Why is it correct?<input value={lessonDraft.explanation} onChange={e => setLessonDraft({...lessonDraft,explanation:e.target.value})} placeholder="A short explanation for learners"/></label></>}</div>}<button className="dark-button" onClick={createLesson}>{editingLessonId ? 'Save changes' : 'Save lesson'} <ArrowRight size={17}/></button>{editingLessonId && <button className="text-link cancel-edit" onClick={() => { setEditingLessonId(null); setLessonDraft({ title: '', summary: '', body: '', media_url: '', media_type: 'none', duration_minutes: 10, prompt: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }); }}>Cancel editing</button>}</div></div><aside className="studio-side"><div className="studio-side-card"><span className="asterisk">✳</span><p className="eyebrow muted">PUBLISHING CHECKLIST</p><h3>A course with care.</h3><p>Add a helpful introduction, one or more lessons, and a practice question. Publish when it’s ready for learners.</p><div className="checklist"><span><CheckCircle2 size={17}/> A clear learning goal</span><span><CheckCircle2 size={17}/> Short, focused lessons</span><span><CheckCircle2 size={17}/> A moment to reflect</span></div></div><div className="studio-side-card course-manager"><p className="eyebrow muted">YOUR COURSES</p><h3>Ready to share?</h3>{courses.filter(x => x.creator_id === profile.id).map(x => <div className="manage-row" key={x.id}><div><strong>{x.title}</strong><small>{lessons.filter(l => l.course_id === x.id).length} lessons · {x.published ? 'Published' : 'Draft'}</small></div>{!x.published ? <button className="small-btn" onClick={() => publish(x.id)}>Publish</button> : <button className="icon-btn" aria-label={`Open ${x.title}`} onClick={() => openCourse(x.id)}><ArrowRight size={18}/></button>}</div>)}{studioCourseId && lessons.filter(l => l.course_id === studioCourseId).length > 0 && <div className="studio-lesson-list"><p className="eyebrow muted">EDIT LESSONS</p>{lessons.filter(l => l.course_id === studioCourseId).sort((a,b) => a.position-b.position).map(l => <button key={l.id} onClick={() => editLesson(l)}>{l.title} <ArrowRight size={15}/></button>)}</div>}{!courses.some(x => x.creator_id === profile.id) && <p className="quiet">Your drafts will appear here.</p>}</div></aside></div></>}
    </main><footer className="footer"><span>forma<span className="accent">.</span></span><p>Learning that stays with you.</p><small>Made for curious minds · {new Date().getFullYear()}</small></footer></div>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {authOpen && configured && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}><div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={21}/></button><div className="brandmark">f<span>.</span></div><p className="eyebrow muted">WELCOME TO FORMA</p><h2 id="auth-title">{authMode === 'signup' ? 'Start something good.' : 'Welcome back.'}</h2><p>{authMode === 'signup' ? 'A space to learn with purpose and share what you know.' : 'Your next lesson is waiting.'}</p><form onSubmit={submitAuth}>{authMode === 'signup' && <><label>Your name<input required minLength={2} value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your full name"/></label><label>I’m here to<select value={authRole} onChange={e => setAuthRole(e.target.value as Role)}><option value="student">Learn</option><option value="creator">Create courses</option></select></label></>}<label>Email<input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" minLength={8} required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="dark-button full" disabled={busy}>{busy ? 'One moment…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button></form>{authMessage && <p className="auth-message" role="status">{authMessage}</p>}<button className="auth-toggle" onClick={() => {setAuthMode(authMode === 'signup' ? 'signin' : 'signup');setAuthMessage('');}}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button><p className="auth-foot"><ShieldCheck size={15}/> Your learning stays yours.</p></div></div>}
  </div>;
}
function CourseCard({ course, progress, count, enrolled, onClick }: { course: Course; progress: number; count: number; enrolled: boolean; onClick: () => void }) { return <button className="course-card" onClick={onClick}><div className={`card-art ${course.color}`}><span className="art-swirl"/><span className="art-symbol">{course.category === 'Data' ? '◈' : course.category === 'Communication' ? '✱' : course.category === 'Design' ? '✳' : '✦'}</span><span className="art-label">FORMA / {course.category.toUpperCase()}</span></div><div className="card-body"><div className="card-tags"><span>{course.category}</span><span>{course.level}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><div className="card-meta"><span><BookOpen size={15}/> {count} lessons</span>{enrolled ? <span>{progress}% complete</span> : <span>Explore <ArrowRight size={15}/></span>}</div>{enrolled && <div className="progress-track"><span style={{width:`${progress}%`}}/></div>}</div></button>; }
