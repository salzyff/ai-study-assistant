import {useEffect,useState} from 'react';
import {apiRequest} from '../api';
export default function PracticeTopics({accessToken,onPractice}){
 const [recommendations,setRecommendations]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;apiRequest('/api/learning/recommendations',{accessToken}).then(d=>{if(active)setRecommendations(d.recommendations||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[accessToken]);
 return ( <div className="practice-panel"><header className="resume-heading"><h2>Topics to practise</h2><p>A little extra attention where it counts.</p></header>{loading?<p role="status" className="practice-empty">Loading your topics…</p>:error?<p role="alert" className="practice-empty">{error}</p>:!recommendations.length?<div className="practice-empty"><p>Complete a quiz to get suggestions based on your results.</p></div>:<div className="practice-topics">{recommendations.slice(0,3).map(t=><article className="practice-topic" key={t.subject+t.topic}><div className="practice-topic-copy"><span>{t.subject}</span><h3>{t.topic}</h3><p>{t.mastery_score}% correct · {t.attempt_count} answers</p></div><button onClick={()=>onPractice(t)}>Practise <span aria-hidden="true">→</span></button></article>)}</div>}</div>);
}
