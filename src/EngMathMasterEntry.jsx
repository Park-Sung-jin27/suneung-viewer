import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMaster } from './engMathMasterClient.js';

function Entry({ userId }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchMaster('status=1', userId, controller.signal).then(r=>r.json()).then(data=>{
      if (!controller.signal.aborted) setAllowed(data.access === 'master');
    }).catch(()=>{}); // Not a master: keep the normal student interface unchanged.
    return ()=>controller.abort();
  }, [userId]);
  return allowed ? <Link className="eng-math-home__account-button" to="/eng-math/master">마스터 전체 문항 열람</Link> : null;
}
export default function EngMathMasterEntry({ user }) {
  return user ? <Entry key={user.id} userId={user.id}/> : null;
}
