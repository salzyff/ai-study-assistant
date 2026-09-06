import {useEffect,useState} from 'react';
import {apiRequest} from '../api';
import {readQuizDraft} from '../utils/quizDraft';
export default function StudyNext({accessToken,userId,conversations,onChat,onTool,onPractice}){
 const [recommendations,setRecommendations]=useState([]),[error,setError]=useState('');
 const draft=readQuizDraft(userId);
 useEffect(()=>{let active=true;apiRequest('/api/learning/recommendations',{accessToken}).then(d=>{if(active)setRecommendations(d.recommendations||[]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[accessToken]);
 return <section className="study-next"><h2>Continue studying</h2><div className="study-next-actions">{conversations[0]&&<button onClick={()=>onChat(conversations[0])}>Resume {conversations[0].subject||'latest'} chat</button>}{draft&&<button onClick={()=>onTool('quiz')}>Resume quiz: {draft.quiz.topic}</button>}<button onClick={()=>onTool('task')}>Continue study tasks</button><button onClick={()=>onTool('flashcards')}>Review due flashcards</button></div><h3>Topics to practise</h3>{error?<p role="alert">{error}</p>:!recommendations.length?<p>Complete a quiz to get practice suggestions based on your results.</p>:recommendations.slice(0,3).map(t=><article key={t.subject+t.topic}><strong>{t.topic} · {t.subject}</strong><p>{t.mastery_score}% across {t.attempt_count} answered questions.</p><button onClick={()=>onPractice(t)}>Practise this topic</button></article>)}</section>;
}
