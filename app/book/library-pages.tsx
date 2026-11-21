"use client";

import { useState, type FormEvent } from "react";
import {
  blankBudget,
  localDate,
  money,
  profiles,
  round,
  totals,
} from "./model.mjs";
import type { Budget, Profile } from "./model.mjs";
import type { Library, LocalBook } from "./library-model.mjs";

export function BookSetup({
  book,
  onCreate,
  onCancel,
  onExample,
  mode = "Household",
}: {
  book?: LocalBook;
  onCreate: (bookName: string, project: Budget) => void;
  onCancel: () => void;
  onExample: () => void;
  mode?: Profile;
}) {
  const [step, setStep] = useState(book ? 1 : 0);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<Profile>(
    book?.projects[0].profile ?? mode,
  );
  const [projectName, setProjectName] = useState("");
  const [total, setTotal] = useState("");
  const [period, setPeriod] = useState(localDate().slice(0, 7));
  const [startDate, setStartDate] = useState(localDate());
  const [endDate, setEndDate] = useState(localDate());
  const [categories, setCategories] = useState(
    profiles[profile].map((name) => ({ name, amount: "" })),
  );
  const [error, setError] = useState("");
  const allocated = round(
    categories.reduce((sum, c) => sum + Number(c.amount || 0), 0),
  );
  function next(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (step === 0 && !name.trim()) {
      setError("Give your book a name.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    const names = categories.map((c) => c.name.trim().toLocaleLowerCase());
    if (names.some((name) => !name)) {
      setError("Give every category a name.");
      return;
    }
    if (new Set(names).size !== names.length) {
      setError("Give each category a different name.");
      return;
    }
    if (allocated > Number(total)) {
      setError("Category allocations cannot exceed this project’s budget.");
      return;
    }
    if (endDate < startDate) { setError("End date must be on or after start date."); return; }
    const project = blankBudget(profile);
    onCreate(book?.name ?? name.trim(), {
      ...project,
      name: projectName.trim() || "General",
      total: round(total),
      period,
      startDate,
      endDate,
      created: true,
      categories: categories.map((category, i) => ({
        id: `category-${i}`,
        name: category.name.trim(),
        amount: round(category.amount),
        owner: "",
        glCode: "",
      })),
      events: [
        {
          text: "Project created with its own budget and categories",
          at: new Date().toISOString(),
        },
      ],
    });
  }
  return (
    <div className="library-page setup-page">
      <ol className="setup-steps" aria-label="Setup progress">
        {["Book", "Project", "Categories"].map((label, i) => (
          <li key={label} aria-current={step === i ? "step" : undefined}>
            <span>{i < step ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="setup-columns">
        <div className="setup-intro">
          <h1>
            {
              [
                "Create a book",
                "Set the project budget",
                "Allocate categories",
              ][step]
            }
          </h1>
          <p>
            {
              [
                "Keep a part of your life together, with a separate budget for each project.",
                "One project, one budget. Other projects keep their own totals.",
                "Choose where this project’s money can go. Change allocations in Budget settings.",
              ][step]
            }
          </p>
          <aside className="setup-note">
            <strong>Book → Project → Categories</strong>
            <p>
              The board connects your plan to the entries you log. Moving a node
              never moves money.
            </p>
          </aside>
        </div>
        <form className="setup-form" onSubmit={next}>
          {step === 0 && (
            <>
              <h2>Your book</h2>
              <label>
                Book name
                <input
                  required
                  maxLength={100}
                  value={name}
                  placeholder="e.g. Small Hours Studio"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <fieldset>
                <legend>{profile} categories</legend>
                <div className="template-choices">
                  {([mode] as Profile[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={profile === item}
                      className={profile === item ? "selected" : ""}
                      onClick={() => {
                        setProfile(item);
                        setCategories(
                          profiles[item].map((name) => ({ name, amount: "" })),
                        );
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  {mode === "Team" ? "Projects, accountable owners and finance codes." : mode === "Just me" ? "Personal plans and everyday spending." : "Shared bills, household spending and family plans."}
                </p>
              </fieldset>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Your first project{book ? " in this book" : ""}</h2>
              <label>
                Project name
                <input
                  value={projectName}
                  maxLength={100}
                  placeholder="e.g. Studio refresh, or General"
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <label>
                Project budget ($)
                <input
                  required
                  inputMode="decimal"
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </label>
              <label>
                Period name
                <input
                  required
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </label>
              <div className="form-pair budget-dates">
                <label>Start date<input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)} /></label>
                <label>End date<input type="date" required min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)} /></label>
              </div>
              <p className="safe-note">
                This is this project’s budget, not a shared pot for the whole
                book.
              </p>
              {!book && (
                <button type="button" className="secondary" onClick={onExample}>
                  Explore an example instead
                </button>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h2>Your categories</h2>
              <p className="hint">
                {money(allocated)} allocated ·{" "}
                {money(round(Number(total) - allocated))} unassigned
              </p>
              <div className="setup-categories">
                {categories.map((category, i) => (
                  <div className="setup-category" key={i}>
                    <label>
                      Category {i + 1}
                      <input
                        required
                        maxLength={100}
                        value={category.name}
                        onChange={(e) =>
                          setCategories((list) =>
                            list.map((c, n) =>
                              n === i ? { ...c, name: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Allocation ($)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        max={total}
                        value={category.amount}
                        onChange={(e) =>
                          setCategories((list) =>
                            list.map((c, n) =>
                              n === i ? { ...c, amount: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="outline-button"
                      disabled={categories.length === 1}
                      aria-label={`Remove category ${i + 1}`}
                      onClick={() =>
                        setCategories((list) => list.filter((_, n) => n !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setCategories((list) => [...list, { name: "", amount: "" }])
                }
              >
                + Add category
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="setup-actions">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                step > (book ? 1 : 0) ? setStep(step - 1) : onCancel()
              }
            >
              {step > (book ? 1 : 0) ? "Back" : "Cancel"}
            </button>
            <button className="primary" type="submit">
              {step === 2 ? "Open my board" : "Continue →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BooksPage({
  library,
  onNewBook,
  onNewProject,
  onOpen,
  onRestore,
  onBackup,
}: {
  library: Library;
  onNewBook: () => void;
  onNewProject: (bookId: string) => void;
  onOpen: (projectId: string) => void;
  onRestore: (file?: File) => void;
  onBackup: () => void;
}) {
  return (
    <div className="library-page">
      <header className="library-heading">
        <div>
          <h1>Your books</h1>
          <p>Separate plans. A place for each one.</p>
        </div>
        <button className="primary" onClick={onNewBook}>
          + New book
        </button>
      </header>
      {!library.books.length && (
        <section className="empty-library">
          <h2>A place for your next chapter.</h2>
          <p>Create a book, then give its first project a budget.</p>
          <button className="primary" onClick={onNewBook}>
            Create my first book
          </button>
        </section>
      )}
      {library.books.map((book) => (
        <section key={book.id} className="library-book">
          <header>
            <div>
              <p className="eyebrow">
                {book.projects[0].profile} book · {book.projects.length}{" "}
                {book.projects.length === 1 ? "project" : "projects"}
              </p>
              <h2>{book.name}</h2>
            </div>
            <button className="secondary" onClick={() => onNewProject(book.id)}>
              + New project
            </button>
          </header>
          {book.projects.map((project) => {
            const t = totals(project);
            return (
              <article
                key={project.id}
                className={`library-project${library.activeProjectId === project.id ? " current" : ""}`}
              >
                <div className="project-title">
                  <h3>{project.name}</h3>
                  <small>
                    {library.activeProjectId === project.id
                      ? "Current project · "
                      : ""}
                    {project.period}
                  </small>
                </div>
                <dl>
                  <div>
                    <dt>Budget</dt>
                    <dd>{money(project.total)}</dd>
                  </div>
                  <div>
                    <dt>In use</dt>
                    <dd>{money(t.spent + t.committed)}</dd>
                  </div>
                  <div>
                    <dt>Left to commit</dt>
                    <dd>{money(t.left)}</dd>
                  </div>
                </dl>
                <button
                  className="secondary"
                  aria-label={`Open ${project.name}`}
                  onClick={() => onOpen(project.id)}
                >
                  Open ↗
                </button>
              </article>
            );
          })}
        </section>
      ))}
      <div className="library-backup">
        <p>Saved in this browser only. A download is your portable copy.</p>
        <button className="secondary" onClick={onBackup}>
          Download all books
        </button>
        <label className="secondary file-button">
          Restore / add books
          <input
            type="file"
            accept=".md,text/markdown"
            onChange={(e) => {
              onRestore(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

export function ProfilePage({
  library,
  onName,
  onBackup,
  onProjectBackup,
  onRestore,
  onSettings,
  hasProject,
}: {
  library: Library;
  onName: (name: string) => void;
  onBackup: () => void;
  onProjectBackup: () => void;
  onRestore: (file?: File) => void;
  onSettings: () => void;
  hasProject: boolean;
}) {
  const [name, setName] = useState(library.profile.name);
  return (
    <div className="library-page">
      <header className="library-heading">
        <div>
          <h1>Your profile</h1>
          <p>A little about you. Your books stay yours.</p>
        </div>
      </header>
      <div className="profile-columns">
        <section className="profile-person">
          <div className="profile-identity">
            <span className="profile-avatar">
              {library.profile.name.charAt(0).toUpperCase() || "Y"}
            </span>
            <div>
              <h2>{library.profile.name || "Your local profile"}</h2>
              <p>Local profile · not signed in</p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onName(name);
            }}
          >
            <label>
              Display name
              <input
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <button className="primary">Save profile</button>
          </form>
          <p className="safe-note">
            This name stays on this device. It does not create an account.
          </p>
        </section>
        <div>
          <section className="profile-section">
            <p className="eyebrow">Your books, on this device</p>
            <h2>Keep a copy close.</h2>
            <p>
              {library.books.length} local{" "}
              {library.books.length === 1 ? "book" : "books"}. Nothing is
              uploaded. Clearing browser data removes local books.
            </p>
            <div className="profile-actions">
              <button className="secondary" onClick={onBackup}>
                Download all books
              </button>
              {hasProject && (
                <button className="secondary" onClick={onProjectBackup}>
                  Download this project (.md)
                </button>
              )}
              <label className="secondary file-button">
                Restore / add books
                <input
                  type="file"
                  accept=".md,text/markdown"
                  onChange={(e) => {
                    onRestore(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="hint">
              Restore adds copies. It never replaces your other books.
            </p>
          </section>
          <section className="profile-section">
            <p className="eyebrow">Account & sync</p>
            <h2>Not signed in.</h2>
            <p>
              Login and cloud saving are not connected yet. Use a downloaded
              backup to move your books between devices.
            </p>
          </section>
          {hasProject && (
            <section className="profile-section">
              <h2>Current project</h2>
              <button className="secondary" onClick={onSettings}>
                Edit project details
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
