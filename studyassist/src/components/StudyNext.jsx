import {useEffect,useState} from 'react';
import {apiRequest} from '../api';
import {readQuizDraft} from '../utils/quizDraft';
export default function StudyNext({accessToken,userId,conversations,onChat,onTool,onPractice}){
 const [recommendations,setRecommendations]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const draft=readQuizDraft(userId);
 useEffect(()=>{let active=true;apiRequest('/api/learning/recommendations',{accessToken}).then(d=>{if(active)setRecommendations(d.recommendations||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[accessToken]);
 const shortcuts=[
  ...(conversations[0]?[{title:'Last conversation',detail:conversations[0].subject||'General',symbol:'chat',action:()=>onChat(conversations[0])}]:[]),
  ...(draft?[{title:'Unfinished quiz',detail:draft.quiz.topic,symbol:'quiz',action:()=>onTool('quiz')}]:[]),
  {title:'Study tasks',detail:'Pick up your study plan',symbol:'tasks',action:()=>onTool('task')},
  {title:'Flashcards',detail:'Review what you’ve learned',symbol:'cards',action:()=>onTool('flashcards')}
 ];
 const paths={chat:'M5 5h14v10H9l-4 4V5Z',quiz:'M8 4h8v3H8z M6 6H4v15h16V6h-2 M8 12h8 M8 16h5',tasks:'m4 7 2 2 3-4 M12 7h8 m-16 9 2 2 3-4 M12 16h8',cards:'M7 7h13v14H7z M4 17H2V2h13v2'};
 return <section className="study-resume"><header className="resume-heading"><h2>Continue studying</h2><p>Pick up where you left off.</p></header><div className="resume-grid">{shortcuts.map(item=><button className="resume-card" key={item.symbol} onClick={item.action}><span className="resume-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[item.symbol]}/></svg></span><span className="resume-copy"><strong>{item.title}</strong><span>{item.detail}</span></span><span className="resume-arrow" aria-hidden="true">→</span></button>)}</div>
 <div className="practice-panel"><header className="resume-heading"><h2>Topics to practise</h2><p>A little extra attention where it counts.</p></header>{loading?<p role="status" className="practice-empty">Loading your topics…</p>:error?<p role="alert" className="practice-empty">{error}</p>:!recommendations.length?<div className="practice-empty"><p>Your next practice starts with a quiz.</p><button onClick={()=>onTool('quiz')}>Choose a topic →</button></div>:<div className="practice-topics">{recommendations.slice(0,3).map(t=><article className="practice-topic" key={t.subject+t.topic}><div className="practice-topic-copy"><span>{t.subject}</span><h3>{t.topic}</h3><p>{t.mastery_score}% correct · {t.attempt_count} answers</p></div><button onClick={()=>onPractice(t)}>Practise <span aria-hidden="true">→</span></button></article>)}</div>}</div></section>;
}
