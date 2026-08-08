import { Link } from 'react-router-dom';
import { en } from '../i18n/en';

/**
 * Home metric board: KPI band, CTAs into the catalog, coverage boundary.
 * Static board — no async list fetch (loading/empty/error live on /sushis).
 */
export function HomePage(): JSX.Element {
  return (
    <main id="main">
      <h1 className="page-title">{en.home.title}</h1>
      <p className="lead">{en.home.lead}</p>
      <div className="kpi-band" aria-label="Catalog metrics">
        <div className="kpi">
          <span className="kpi__label">{en.home.kpiPlaces}</span>
          <span className="kpi__value">D1</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">{en.home.kpiPublic}</span>
          <span className="kpi__value">{en.home.kpiPublicValue}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">{en.home.kpiSearch}</span>
          <span className="kpi__value">{en.home.kpiSearchValue}</span>
        </div>
      </div>
      <div className="home-actions">
        <Link className="btn btn--primary" to="/sushis">
          {en.home.ctaList}
        </Link>
        <Link className="btn" to="/sushis/new">
          {en.home.ctaAdd}
        </Link>
      </div>
      <section className="coverage-boundary" aria-labelledby="home-coverage-heading">
        <h2 id="home-coverage-heading">{en.home.coverageTitle}</h2>
        <p>{en.home.coverageBody}</p>
      </section>
    </main>
  );
}
