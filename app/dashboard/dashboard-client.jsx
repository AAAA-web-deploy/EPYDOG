"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import './dashboard.css';
import { api, errorMessage } from './api.js';
import { apiOrigin, apiUrl } from './origin.js';
const initialFilters = {
    range: 'today',
    from: '',
    to: '',
    campaign: '',
    referrer: '',
    bots: false,
    tests: false,
};
const clickLabels = {
    copy: 'Copy CA',
    community: 'Community',
    x: 'X',
    uniswap: 'Uniswap',
    etherscan: 'Etherscan',
    song: 'Song',
    enter: 'Enter',
    buy: 'Buy',
    chart: 'Chart',
    gmgn: 'Chart link',
};
function formatNy(ms) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    }).format(ms);
}
function queryString(filters, extra = {}) {
    const params = new URLSearchParams();
    params.set('range', filters.range);
    if (filters.range === 'custom') {
        if (filters.from)
            params.set('from', filters.from);
        if (filters.to)
            params.set('to', filters.to);
    }
    if (filters.campaign.trim())
        params.set('campaign', filters.campaign.trim());
    if (filters.referrer.trim())
        params.set('referrer', filters.referrer.trim());
    if (filters.bots)
        params.set('bots', '1');
    if (filters.tests)
        params.set('tests', '1');
    for (const [key, value] of Object.entries(extra))
        params.set(key, value);
    return params.toString();
}
export default function Dashboard() {
    const [csrf, setCsrf] = useState('');
    const [phase, setPhase] = useState('checking');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginNotice, setLoginNotice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [filters, setFilters] = useState(initialFilters);
    const [applied, setApplied] = useState(initialFilters);
    const [summary, setSummary] = useState(null);
    const summaryRef = useRef(null);
    const [visits, setVisits] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [stale, setStale] = useState(false);
    const [refreshedAt, setRefreshedAt] = useState(null);
    const [selected, setSelected] = useState([]);
    const [detail, setDetail] = useState(null);
    const [revealed, setRevealed] = useState({});
    const [notice, setNotice] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [includeIps, setIncludeIps] = useState(false);
    const pageSize = 25;
    const load = useCallback(async (nextPage, nextFilters) => {
        const summaryResult = await api(`/api/dashboard/analytics/summary?${queryString(nextFilters)}`);
        if (summaryResult.status === 401) {
            summaryRef.current = null;
            setPhase('login');
            setLoginNotice('');
            setError('');
            return;
        }
        const visitResult = await api(`/api/dashboard/analytics/visits?${queryString(nextFilters, { page: String(nextPage), pageSize: String(pageSize) })}`);
        if (!summaryResult.ok || !visitResult.ok) {
            setError(errorMessage(summaryResult.status, summaryResult.data, 'Visitor estimates could not be loaded.'));
            setStale(Boolean(summaryRef.current));
            return;
        }
        summaryRef.current = summaryResult.data;
        setSummary(summaryResult.data);
        setVisits(visitResult.data.visits ?? []);
        setTotal(visitResult.data.total ?? 0);
        setPage(nextPage);
        setError('');
        setStale(false);
        setRefreshedAt(summaryResult.data.generatedAt ?? Date.now());
    }, []);
    useEffect(() => {
        let cancelled = false;
        void api('/api/dashboard/session').then((result) => {
            if (cancelled)
                return;
            if (!result.ok || !result.data.csrfToken) {
                setLoginError(errorMessage(result.status, result.data, 'The dashboard service is unavailable on this host.'));
                setPhase('login');
                return;
            }
            setCsrf(result.data.csrfToken);
            setPhase(result.data.authenticated ? 'ready' : 'login');
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        if (phase !== 'ready' || !csrf)
            return;
        void load(page, applied);
        const tick = () => {
            if (document.visibilityState !== 'visible')
                return;
            void load(page, applied);
        };
        const timer = window.setInterval(tick, 10000);
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                tick();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [phase, csrf, applied, page, load]);
    async function onLogin(event) {
        event.preventDefault();
        setSubmitting(true);
        setLoginError('');
        const result = await api('/api/dashboard/login', {
            method: 'POST',
            csrf,
            body: { password },
        });
        setSubmitting(false);
        if (!result.ok || !result.data.csrfToken) {
            setLoginError(errorMessage(result.status, result.data, 'Incorrect password. Please try again.'));
            return;
        }
        setCsrf(result.data.csrfToken);
        setPassword('');
        setLoginNotice('');
        setPhase('ready');
    }
    async function logout() {
        await api('/api/dashboard/logout', { method: 'POST', csrf, body: {} });
        setPhase('login');
        setSummary(null);
        setVisits([]);
        setDetail(null);
        setNotice('');
        const session = await api('/api/dashboard/session');
        if (session.data.csrfToken)
            setCsrf(session.data.csrfToken);
    }
    async function onPasswordChange(event) {
        event.preventDefault();
        const result = await api('/api/dashboard/change-password', {
            method: 'POST',
            csrf,
            body: { currentPassword, newPassword, confirmPassword },
        });
        if (!result.ok) {
            setNotice(errorMessage(result.status, result.data, 'Password was not changed.'));
            return;
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSummary(null);
        setPhase('login');
        setLoginNotice(result.data.message ?? 'Password changed. Sign in with the new password.');
        const session = await api('/api/dashboard/session');
        if (session.data.csrfToken)
            setCsrf(session.data.csrfToken);
    }
    async function reveal(id) {
        if (revealed[id]) {
            setRevealed((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
            return;
        }
        const result = await api(`/api/dashboard/analytics/visits/${id}?reveal=1`);
        if (!result.ok) {
            setNotice(errorMessage(result.status, result.data, 'The IP address could not be revealed.'));
            return;
        }
        setRevealed((current) => ({ ...current, [id]: result.data.ip }));
    }
    async function openDetail(id) {
        const result = await api(`/api/dashboard/analytics/visits/${id}`);
        if (!result.ok) {
            setNotice(errorMessage(result.status, result.data, 'Visit details could not be loaded.'));
            return;
        }
        setDetail(result.data);
    }
    async function removeSelected() {
        const result = await api('/api/dashboard/analytics/delete', {
            method: 'POST',
            csrf,
            body: { ids: selected },
        });
        if (!result.ok) {
            setNotice(errorMessage(result.status, result.data, 'Those visits could not be deleted.'));
            return;
        }
        setNotice(`Deleted ${result.data.deleted ?? selected.length} visits.`);
        setSelected([]);
        setConfirmDelete(false);
        setDetail(null);
        await load(1, applied);
    }
    async function exportCsv() {
        const response = await fetch(apiUrl(`/api/dashboard/analytics/export?${queryString(applied, includeIps ? { reveal: '1' } : {})}`), {
            headers: { 'x-csrf-token': csrf, accept: 'text/csv' },
            credentials: apiOrigin() ? 'include' : 'same-origin',
            cache: 'no-store',
        });
        if (!response.ok) {
            setNotice('The CSV export could not be downloaded.');
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'eepy-visits.csv';
        link.click();
        URL.revokeObjectURL(url);
        setNotice('Export downloaded.');
    }
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const maxTrend = Math.max(1, ...(summary?.trend.map((bucket) => bucket.visitors) ?? [1]));
    const peak = summary && summary.trend.length > 0
        ? summary.trend.reduce((best, bucket) => (bucket.visitors > best.visitors ? bucket : best), summary.trend[0])
        : undefined;
    if (phase !== 'ready') {
        return (<main className="dash" id="dashboard-main">
        <h1>Private Visitor Dashboard</h1>
        {phase === 'checking' ? (<p role="status">Checking session…</p>) : (<form className="dash-card" onSubmit={onLogin}>
            {loginNotice && <p role="status">{loginNotice}</p>}
            <label htmlFor="dashboard-password">Password</label>
            <input id="dashboard-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/>
            <button className="btn btn-gold" type="submit" disabled={submitting || !csrf}>
              Open dashboard
            </button>
            {loginError && (<p id="dashboard-login-error" role="alert">
                {loginError}
              </p>)}
          </form>)}
      </main>);
    }
    return (<main className="dash" id="dashboard-main">
      <div className="dash-top">
        <h1>Private Visitor Dashboard</h1>
        <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
          Log out
        </button>
      </div>
      <p className="dash-note">Each IP address is counted once. Times are America/New_York.</p>
      {notice && <p role="status">{notice}</p>}
      <form className="dash-filters" onSubmit={(event) => {
            event.preventDefault();
            setApplied(filters);
            setPage(1);
            setConfirmDelete(false);
        }}>
        <div className="dash-filter-fields">
        <label>
          Range
          <select value={filters.range} onChange={(event) => setFilters({ ...filters, range: event.target.value })}>
            <option value="today">Today in New York</option>
            <option value="24h">Rolling last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {filters.range === 'custom' && (<>
            <label>
              From
              <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} required/>
            </label>
            <label>
              To
              <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} required/>
            </label>
          </>)}
        <label>
          Campaign
          <input value={filters.campaign} onChange={(event) => setFilters({ ...filters, campaign: event.target.value })}/>
        </label>
        <label>
          Referrer
          <input value={filters.referrer} onChange={(event) => setFilters({ ...filters, referrer: event.target.value })}/>
        </label>
        </div>
        <div className="dash-filter-actions">
        <label className="dash-check">
          <input type="checkbox" checked={filters.bots} onChange={(event) => {
            const next = { ...filters, bots: event.target.checked };
            setFilters(next);
            setApplied(next);
        }}/>
          Include likely bots
        </label>
        <label className="dash-check">
          <input type="checkbox" checked={filters.tests} onChange={(event) => {
            const next = { ...filters, tests: event.target.checked };
            setFilters(next);
            setApplied(next);
        }}/>
          Include admin and development traffic
        </label>
        <button className="btn btn-gold" type="submit">
          Apply filters
        </button>
        </div>
      </form>

      {!summary && !error && <p role="status">Loading visitor estimates…</p>}
      {error && (<p role="alert">
          {stale ? 'Latest refresh failed. Showing the last successful numbers. ' : ''}
          {error}{' '}
          <button type="button" onClick={() => void load(page, applied)}>
            Retry
          </button>
        </p>)}
      {summary && (<>
          <p className="dash-refresh">
            Last successful refresh: {refreshedAt ? formatNy(refreshedAt) : 'Not yet'}
            {stale ? ' (stale)' : ''}
          </p>
          <section className="dash-stats" aria-label="Summary">
            <article className="is-lead">
              <p>Active visitors</p>
              <strong>{summary.activeVisitors}</strong>
              <span>Each IP address online now</span>
            </article>
            <article>
              <p>Unique visitors</p>
              <strong>{summary.browserVisitors}</strong>
              <span>Each IP address once in this range</span>
            </article>
            <article>
              <p>Visits</p>
              <strong>{summary.visits}</strong>
              <span>Separate sessions</span>
            </article>
            <article>
              <p>Page views</p>
              <strong>{summary.pageViews}</strong>
              <span>Loads and reloads</span>
            </article>
            <article className="dash-cta">
              <div>
                <p>CTA clicks</p>
                <strong>{summary.clicks.total}</strong>
              </div>
              <ul className="cta-chips">
                <li><span>Copy CA</span><strong>{summary.clicks.copy || 0}</strong></li>
                <li><span>X</span><strong>{summary.clicks.x || 0}</strong></li>
                <li><span>Community</span><strong>{summary.clicks.community || 0}</strong></li>
                <li><span>Uniswap</span><strong>{summary.clicks.uniswap || 0}</strong></li>
                <li><span>Etherscan</span><strong>{summary.clicks.etherscan || 0}</strong></li>
                <li><span>Song</span><strong>{summary.clicks.song || 0}</strong></li>
              </ul>
            </article>
          </section>
          <section className="dash-card" aria-labelledby="trend-heading">
            <div className="dash-top">
              <h2 id="trend-heading">Visit trend</h2>
              <p className="dash-quiet">
                {summary.trendUnit === 'day' ? 'Unique visitors per day' : 'Unique visitors per hour'}
                {peak && peak.visitors > 0 ? ` · Peak ${peak.visitors} at ${peak.label}` : ''}
              </p>
            </div>
            {summary.trend.every((bucket) => bucket.visitors === 0) ? (<p>No visitors in this range.</p>) : (<div className="trend-chart" role="list" aria-label="Unique visitors over time" style={{ gridTemplateColumns: `repeat(${summary.trend.length}, minmax(0, 1fr))` }}>
                {summary.trend.map((bucket, index) => {
                    const isPeak = Boolean(peak && bucket.start === peak.start && bucket.visitors > 0);
                    const labelStep = summary.trend.length > 18 ? 3 : 1;
                    const showLabel = index % labelStep === 0 || isPeak || index === summary.trend.length - 1;
                    const height = bucket.visitors === 0 ? 0 : Math.max(14, (bucket.visitors / maxTrend) * 100);
                    return (<div role="listitem" className={isPeak ? 'trend-col is-peak' : bucket.visitors > 0 ? 'trend-col' : 'trend-col is-zero'} key={bucket.start} title={`${bucket.label}: ${bucket.visitors} unique visitors`}>
                      <span className="trend-count">{bucket.visitors > 0 ? bucket.visitors : ''}</span>
                      <span className="trend-bar" aria-hidden="true">
                        <span style={{ height: `${height}%` }}/>
                      </span>
                      <span className={showLabel ? 'trend-label' : 'trend-label is-hidden'}>{bucket.label}</span>
                    </div>);
                })}
              </div>)}
          </section>
          <div className="dash-split">
            <section className="dash-card" aria-labelledby="referrer-heading">
              <h2 id="referrer-heading">Referrals</h2>
              {summary.referrals.length === 0 ? <p>No referrals in this range.</p> : (<ul>
                  {summary.referrals.map((row) => (<li key={row.host}>
                      {row.host}: {row.visits}
                    </li>))}
                </ul>)}
            </section>
            <section className="dash-card" aria-labelledby="campaign-heading">
              <h2 id="campaign-heading">Campaigns</h2>
              {summary.campaigns.length === 0 ? <p>No campaigns in this range.</p> : (<ul>
                  {summary.campaigns.map((row) => (<li key={`${row.source}-${row.medium}-${row.campaign}`}>
                      {[row.source, row.medium, row.campaign].filter(Boolean).join(' / ') || '(blank)'}: {row.visits}
                    </li>))}
                </ul>)}
            </section>
          </div>
        </>)}

      <section className="dash-card dash-history" aria-labelledby="history-heading">
        <div className="history-head">
          <div>
            <h2 id="history-heading">Visit history</h2>
            <p className="dash-quiet">Location is the city, region, and country for each visit.</p>
          </div>
          <div className="dash-actions">
            <label className="dash-check">
              <input type="checkbox" checked={includeIps} onChange={(event) => setIncludeIps(event.target.checked)}/>
              Include full IP addresses in the export
            </label>
            <button className="btn btn-ghost" type="button" onClick={() => void exportCsv()}>
              Export CSV
            </button>
            <button className="btn btn-dark" type="button" disabled={selected.length === 0} onClick={() => setConfirmDelete(true)}>
              Delete selected
            </button>
          </div>
        </div>
        {confirmDelete && (<p className="dash-confirm">
            Delete {selected.length} selected visits?
            <button type="button" onClick={() => void removeSelected()}>
              Confirm delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </p>)}
        {summary && visits.length === 0 && <p>No visits in this range.</p>}
        <ul className="visit-list">
          {visits.map((visit) => (<li className="visit-row" key={visit.id}>
              <input type="checkbox" checked={selected.includes(visit.id)} aria-label={`Select visit ${visit.id}`} onChange={(event) => {
                setSelected((current) => event.target.checked ? [...current, visit.id] : current.filter((id) => id !== visit.id));
            }}/>
              <div className="visit-main">
                <div className="visit-headline">
                  <strong className="visit-place">{visit.location || 'Unavailable'}</strong>
                  <span className="visit-badge">{visit.classification}</span>
                </div>
                <p className="visit-when">
                  Started {formatNy(visit.startedAt)} · Last seen {formatNy(visit.lastSeen)}
                </p>
                <p className="visit-meta">
                  {visit.path}
                  {visit.section ? ` · ${visit.section}` : ''}
                  {' · '}
                  {visit.browser} / {visit.os} / {visit.device}
                  {' · '}
                  {visit.referrer}
                  {visit.utmCampaign ? ` · ${visit.utmCampaign}` : ''}
                </p>
              </div>
              <div className="visit-actions">
                <span className="visit-ip">{revealed[visit.id] ?? visit.ip}</span>
                <button type="button" onClick={() => void reveal(visit.id)} disabled={!visit.ipAvailable && !revealed[visit.id]}>
                  {revealed[visit.id] ? 'Hide IP' : 'Reveal IP'}
                </button>
                <button type="button" onClick={() => void openDetail(visit.id)}>
                  View
                </button>
              </div>
            </li>))}
        </ul>
        <div className="dash-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
        {detail && (<article className="dash-detail" aria-labelledby="detail-heading">
            <h3 id="detail-heading">Visit details</h3>
            <p>
              {detail.path} · {detail.section ?? 'no section'} · {detail.classification}
            </p>
            <p>Location: {detail.location || 'Unavailable'}</p>
            <p>Started {formatNy(detail.startedAt)}. Last seen {formatNy(detail.lastSeen)}.</p>
            <h4>Page views</h4>
            {(detail.pageViews ?? []).length === 0 ? <p>No page views stored.</p> : (<ul>
                {detail.pageViews?.map((view) => (<li key={`${view.createdAt}-${view.path}`}>
                    {formatNy(view.createdAt)} · {view.path}
                  </li>))}
              </ul>)}
            <h4>CTA clicks</h4>
            {(detail.clicks ?? []).length === 0 ? <p>No CTA clicks stored.</p> : (<ul>
                {detail.clicks?.map((click) => (<li key={`${click.createdAt}-${click.kind}`}>
                    {formatNy(click.createdAt)} · {clickLabels[click.kind] || click.kind}
                  </li>))}
              </ul>)}
            <button type="button" onClick={() => setDetail(null)}>
              Close details
            </button>
          </article>)}
      </section>

      <section className="dash-card">
        <h2>Change password</h2>
        <form className="dash-password" onSubmit={onPasswordChange}>
          <label>
            Current password
            <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/>
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8}/>
          </label>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8}/>
          </label>
          <button className="btn btn-gold" type="submit">
            Change password
          </button>
        </form>
      </section>
    </main>);
}
