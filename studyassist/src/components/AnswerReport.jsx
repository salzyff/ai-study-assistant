import { reportableId } from "../utils/chatSafety";
import {useState} from 'react';
import {apiRequest} from '../api';
export default function AnswerReport({accessToken,kind,sourceId,containerId}) {
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 if(!reportableId(sourceId)||!reportableId(containerId)) return null;
 if(sent) return <small role="status">Report sent for administrator review.</small>;
 return <div className="answer-report">{!open?<button type="button" onClick={()=>setOpen(true)}>Report incorrect answer</button>:<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await apiRequest('/api/study-upgrades/answer-reports',{accessToken,method:'POST',body:{kind,sourceId,containerId,reason}});setSent(true);}catch(err){setError(err.message);}finally{setBusy(false);}}}>
 <label>What seems incorrect?<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <button disabled={busy||!reason.trim()}>Send report</button><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>{error&&<p role="alert">{error}</p>}
 </form>}</div>;
}
