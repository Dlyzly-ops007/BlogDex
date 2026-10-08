import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const paths = {
  home: ['m3 10 9-7 9 7','M5 9v12h5v-7h4v7h5V9'],
  search: ['M21 21l-5-5','M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z'],
  message: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z'],
  plus: ['M12 5v14','M5 12h14'],
  more: ['M5 12h.01','M12 12h.01','M19 12h.01'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M16 3a4 4 0 0 1 0 8','M22 21v-2a4 4 0 0 0-3-3.9','M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  user: ['M20 21v-2a7 7 0 0 0-14 0v2','M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  lock: ['M5 10h14v11H5z','M8 10V6a4 4 0 0 1 8 0v4'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9','M10 21h4'],
  logout: ['M9 3H4v18h5','M9 12h12','m17 8 4 4-4 4'],
  sun: ['M12 2v2','M12 20v2','m4.9 4.9 1.4 1.4','m17.7 17.7 1.4 1.4','M2 12h2','M20 12h2','m6.3 17.7-1.4 1.4','m19.1 4.9-1.4 1.4','M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z'],
  x: ['M18 6 6 18','M6 6l12 12'],
  arrow: ['M5 12h14','m13 6 6 6-6 6'],
  back: ['M19 12H5','m11 6-6 6 6 6'],
  chevron: ['m9 5 7 7-7 7'],
  fire: ['M12 3c1 6-4 5-4 10-3-2-3-4-3-4-5 9 1 13 7 13s10-7 4-13c0 4-2 5-2 5s2-7-2-11z'],
  shield: ['m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z','m8 12 3 3 5-6'],
  send: ['m22 2-7 20-4-9-9-4z','M22 2 11 13'],
  edit: ['m16 3 5 5-12 12-6 1 1-6z','m14 5 5 5'],
  check: ['m5 12 4 4L19 6'],
  share: ['M12 16V3','m7 8 5-5 5 5','M4 14v7h16v-7'],
  link: ['M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2','M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2'],
  map: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0','M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  smile: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0','M8 9h.01','M16 9h.01','M8 14s1 3 4 3 4-3 4-3'],
  menu: ['M3 6h18','M3 12h18','M3 18h18'],
  grid: ['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],
  loader: ['M21 12a9 9 0 1 1-6.2-8.6'],
  warning: ['m12 3 10 18H2z','M12 9v4','M12 17h.01'],
  camera: ['M3 6h5l2-3h4l2 3h5v15H3z','M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  refresh: ['M20 7v5h-5','M4 17v-5h5','M6 6a8 8 0 0 1 13 2l1 4','M18 18a8 8 0 0 1-13-2l-1-4'],
  trash: ['M3 6h18','M9 6V3h6v3','M5 6l1 15h12l1-15','M10 10v7','M14 10v7'],
  flag: ['M4 22V3','M4 3c6-4 10 4 16 0v12c-6 4-10-4-16 0'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  eyeOff: ['m3 3 18 18','M10 5c7-1 12 7 12 7s-1 3-4 5','M6 6c-3 2-4 6-4 6s3 7 10 7c2 0 4-1 5-2'],
  calendar: ['M3 5h18v16H3z','M16 3v4','M8 3v4','M3 11h18'],
};

export function Icon({ name, size = 20, className = '', ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>{(paths[name] || paths.message).map((d, i) => <path key={i} d={d} />)}</svg>;
}

export function Brand({ small = false }) {
  return <Link className={`brand ${small ? 'small' : ''}`} to="/" aria-label="BlogDex home"><img src="/brand-logo.svg" alt="BlogDex" width="554" height="160" /></Link>;
}

export function Avatar({ profile, size = 'medium' }) {
  const name = profile?.display_name || profile?.username || 'You';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return <span className={`avatar avatar-${size}`} style={{ '--avatar-hue': hue }} aria-label={name}>
    <span aria-hidden="true">{initials}</span>
  </span>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="loading" role="status"><Icon name="loader" className="spin" size={23} /><span>{label}</span></div>;
}

export function Empty({ icon = 'message', title, description, children }) {
  return <div className="empty"><span className="empty-icon"><Icon name={icon} size={30} /></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return <div className="error-box" role="alert"><Icon name="warning" /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Retry</button>}</div>;
}

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const titleId = `modal-${title.replace(/\W/g, '')}`;
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="x" /></button></div>
    {children}
  </dialog>;
}

export function PostText({ text = '' }) {
  const regex = /https?:\/\/[^\s]+|#[\p{L}\p{N}_]+|@[a-zA-Z0-9_]+/gu;
  const fragments = [];
  let last = 0;
  for (const match of text.matchAll(regex)) {
    fragments.push(text.slice(last, match.index));
    const value = match[0];
    fragments.push(value.startsWith('http')
      ? <a key={match.index} href={value} target="_blank" rel="noopener noreferrer">{value}</a>
      : <Link key={match.index} to={value[0] === '#' ? `/explore?q=${encodeURIComponent(value.slice(1))}` : `/profile/${value.slice(1)}`}>{value}</Link>);
    last = match.index + value.length;
  }
  fragments.push(text.slice(last));
  return <p className="post-text">{fragments}</p>;
}
