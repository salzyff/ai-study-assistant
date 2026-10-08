import {readQuizDraft} from '../utils/quizDraft';
export default function StudyNext({userId,conversations,onChat,onTool}){
 const draft=readQuizDraft(userId);
 const shortcuts=[
  ...(conversations[0]?[{title:'Last conversation',detail:conversations[0].subject||'General',symbol:'chat',action:()=>onChat(conversations[0])}]:[]),
  ...(draft?[{title:'Unfinished quiz',detail:draft.quiz.topic,symbol:'quiz',action:()=>onTool('quiz')}]:[]),
  {title:'Study tasks',detail:'Pick up your study plan',symbol:'tasks',action:()=>onTool('task')},
  {title:'Flashcards',detail:'Review what you’ve learned',symbol:'cards',action:()=>onTool('flashcards')}
 ];
 const paths={chat:'M5 5h14v10H9l-4 4V5Z',quiz:'M8 4h8v3H8z M6 6H4v15h16V6h-2 M8 12h8 M8 16h5',tasks:'m4 7 2 2 3-4 M12 7h8 m-16 9 2 2 3-4 M12 16h8',cards:'M7 7h13v14H7z M4 17H2V2h13v2'};
 return <section className="study-resume"><header className="resume-heading"><h2>Continue studying</h2><p>Your recent chats and quick review tools.</p></header><div className="resume-grid">{shortcuts.map(item=><button className="resume-card" key={item.symbol} onClick={item.action}><span className="resume-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[item.symbol]}/></svg></span><span className="resume-copy"><strong>{item.title}</strong><span>{item.detail}</span></span><span className="resume-arrow" aria-hidden="true">→</span></button>)}</div>
</section>;
}

