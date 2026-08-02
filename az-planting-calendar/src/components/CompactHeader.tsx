import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { formatFrostDate } from '../lib/halfMonth';
import { en } from '../i18n/en';
import type { CropListItem, Method, Zone } from '../lib/schemas';
import type { FiltersState } from './Filters';
import { LiveSearch } from './LiveSearch';
import { ThemeToggle } from './ThemeToggle';
import { ZoneSelector } from './ZoneSelector';
import './CompactHeader.css';

/** Desktop breakpoint where the filter drawer may open by default (matches mockup 900px). */
const DRAWER_DESKTOP_MQ = '(min-width: 900px)';

export interface CompactHeaderProps {
  zone: Zone | null;
  filters: FiltersState;
  onFiltersChange: (next: FiltersState) => void;
  searchResults: CropListItem[] | null;
  searching: boolean;
  searchError: string | null;
  onSearchRetry: () => void;
}

/**
 * Option 3 home chrome: compact bar (brand, search, Filters, theme, nav) + expandable
 * filter drawer (zone, method, month, frost). Drawer starts collapsed at 375;
 * open by default only on desktop so the timeline hero keeps fold space on mobile.
 */
export function CompactHeader({
  zone,
  filters,
  onFiltersChange,
  searchResults,
  searching,
  searchError,
  onSearchRetry
}: CompactHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  /** Collapsed at 375 by default; open at >=900 only on first mount (hero budget). */
  const [drawerOpen, setDrawerOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DRAWER_DESKTOP_MQ).matches;
  });

  /**
   * Toggle the filter drawer.
   */
  function toggleDrawer(): void {
    setDrawerOpen((v) => !v);
  }

  /**
   * Toggle mobile primary nav.
   */
  function toggleNav(): void {
    setNavOpen((v) => !v);
  }

  /**
   * Clear method, month, and crop search; keep the selected plantable date.
   */
  function clearFilters(): void {
    onFiltersChange({ method: '', month: '', date: filters.date, q: '' });
  }

  return (
    <header className="compact-header" data-testid="compact-header" data-measure="header">
      <div className="compact-header__bar">
        <Link to="/" className="compact-header__logo" aria-label={en.appName}>
          <img
            className="compact-header__mark"
            src="/brand-mark.png"
            alt=""
            width={96}
            height={96}
            aria-hidden="true"
            decoding="async"
            data-measure="mark"
          />
          <span className="compact-header__name">{en.appName}</span>
        </Link>

        <div className="compact-header__search" data-measure="search-slot">
          <LiveSearch
            value={filters.q}
            onChange={(q) => onFiltersChange({ ...filters, q })}
            results={searchResults}
            searching={searching}
            searchError={searchError}
            onRetry={onSearchRetry}
            embedded
          />
        </div>

        <button
          type="button"
          className={
            drawerOpen
              ? 'compact-header__filters-btn compact-header__filters-btn--open'
              : 'compact-header__filters-btn'
          }
          aria-expanded={drawerOpen}
          aria-controls="filter-drawer"
          onClick={toggleDrawer}
          data-testid="filter-drawer-toggle"
        >
          {en.filters.title}
        </button>

        <div className="compact-header__theme">
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="compact-header__menu-btn"
          aria-expanded={navOpen}
          aria-controls="primary-nav-mobile"
          onClick={toggleNav}
          data-testid="nav-menu-toggle"
        >
          {navOpen ? en.nav.menuClose : en.nav.menuOpen}
        </button>

        <nav className="compact-header__nav" aria-label="Primary" data-testid="primary-nav-desktop">
          <NavLink to="/" end className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.home}
          </NavLink>
          <NavLink to="/grid" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.grid}
          </NavLink>
          <NavLink to="/about" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.about}
          </NavLink>
          <NavLink to="/contact" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.contact}
          </NavLink>
        </nav>
      </div>

      <nav
        id="primary-nav-mobile"
        className={
          navOpen
            ? 'compact-header__nav-mobile compact-header__nav-mobile--open'
            : 'compact-header__nav-mobile'
        }
        aria-label="Primary"
        hidden={!navOpen}
      >
        <NavLink to="/" end className={navClass} onClick={() => setNavOpen(false)}>
          {en.nav.home}
        </NavLink>
        <NavLink to="/grid" className={navClass} onClick={() => setNavOpen(false)}>
          {en.nav.grid}
        </NavLink>
        <NavLink to="/about" className={navClass} onClick={() => setNavOpen(false)}>
          {en.nav.about}
        </NavLink>
        <NavLink to="/contact" className={navClass} onClick={() => setNavOpen(false)}>
          {en.nav.contact}
        </NavLink>
      </nav>

      <div
        id="filter-drawer"
        className={
          drawerOpen
            ? 'compact-header__drawer compact-header__drawer--open'
            : 'compact-header__drawer'
        }
        data-testid="filter-drawer"
        hidden={!drawerOpen}
      >
        <div className="compact-header__drawer-grid">
          <div className="compact-header__drawer-field compact-header__drawer-field--zone">
            <ZoneSelector />
          </div>
          <label className="compact-header__drawer-field">
            <span className="compact-header__drawer-label">{en.filters.method}</span>
            <select
              className="compact-header__control"
              value={filters.method}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  method: e.target.value as Method | ''
                })
              }
              data-testid="filter-method"
              aria-label={en.filters.method}
            >
              <option value="">{en.filters.methodAll}</option>
              <option value="S">{en.filters.methodSeed}</option>
              <option value="T">{en.filters.methodTransplant}</option>
            </select>
          </label>
          <label className="compact-header__drawer-field">
            <span className="compact-header__drawer-label">{en.filters.month}</span>
            <select
              className="compact-header__control"
              value={filters.month === '' ? '' : String(filters.month)}
              onChange={(e) => {
                const v = e.target.value;
                onFiltersChange({
                  ...filters,
                  month: v === '' ? '' : Number(v)
                });
              }}
              data-testid="filter-month"
              aria-label={en.filters.month}
            >
              <option value="">{en.filters.monthAll}</option>
              {en.filters.months.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="compact-header__clear"
            onClick={clearFilters}
            data-testid="filter-clear"
          >
            {en.filters.clear}
          </button>
          {zone ? (
            <p className="compact-header__frost mono" data-testid="zone-frost">
              <span>
                {en.zone.lastFrostShort} {formatFrostDate(zone.last_frost)}
              </span>
              <span className="compact-header__sep" aria-hidden="true">
                ·
              </span>
              <span>
                {en.zone.firstFrostShort} {formatFrostDate(zone.first_frost)}
              </span>
              {zone.elevation_ft != null ? (
                <>
                  <span className="compact-header__sep" aria-hidden="true">
                    ·
                  </span>
                  <span>{en.zone.elevation(zone.elevation_ft)}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * @param args - NavLink className args.
 */
function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'compact-header__link compact-header__link--active'
    : 'compact-header__link';
}
