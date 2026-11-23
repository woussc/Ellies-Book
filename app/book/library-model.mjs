import {
  blankBudget,
  exampleBudget,
  parseBook,
  readStoredBudget,
  serializeBook,
  validateBudget,
} from "./model.mjs";

export const LIBRARY_KEY = "ellies-book:library:v1.md";
const EXAMPLE_ID = "example";
const newId = () => crypto.randomUUID();

export function emptyLibrary() {
  return { books: [], activeProjectId: "", profile: { name: "" } };
}

function validate(library) {
  if (
    !library ||
    !Array.isArray(library.books) ||
    typeof library.activeProjectId !== "string" ||
    !library.profile ||
    typeof library.profile.name !== "string" ||
    library.profile.name.length > 100
  ) {
    throw new Error("This library is not a supported Ellie’s Book backup.");
  }
  const books = new Set(),
    projects = new Set();
  for (const book of library.books) {
    if (
      !book ||
      typeof book.id !== "string" ||
      !book.id ||
      books.has(book.id) ||
      typeof book.name !== "string" ||
      !book.name.trim() ||
      !Array.isArray(book.projects) ||
      !book.projects.length
    ) {
      throw new Error("This library contains an invalid book.");
    }
    books.add(book.id);
    for (const project of book.projects) {
      validateBudget(project);
      if (
        project.sample ||
        projects.has(project.id) ||
        project.id === EXAMPLE_ID
      )
        throw new Error("Each project needs its own ID.");
      projects.add(project.id);
    }
  }
  if (library.example) {
    validateBudget(library.example);
    if (!library.example.sample)
      throw new Error("The example must stay separate from your books.");
    projects.add(EXAMPLE_ID);
  }
  if (
    (projects.size && !projects.has(library.activeProjectId)) ||
    (!projects.size && library.activeProjectId)
  ) {
    throw new Error(
      "The selected project is missing. Keep the original backup.",
    );
  }
  return library;
}

export function activeBudget(library) {
  if (library.activeProjectId === EXAMPLE_ID) return library.example;
  return (
    library.books
      .flatMap((book) => book.projects)
      .find((project) => project.id === library.activeProjectId) ?? null
  );
}

export function serializeLibrary(library) {
  validate(library);
  const data = {
    ...library,
    books: library.books.map((book) => ({
      ...book,
      projects: book.projects.map(serializeBook),
    })),
    ...(library.example ? { example: serializeBook(library.example) } : {}),
  };
  return `---\nschema: ellies-book/library-v1\ndata: ${JSON.stringify(data)}\n---\n# Ellie’s Book library\n\nEach project contains its own Markdown book. Budgets are not pooled.\n`;
}

export function parseLibrary(markdown) {
  const match =
    /^---\r?\nschema: ellies-book\/library-v1\r?\ndata: ([^\r\n]+)\r?\n---(?:\r?\n|$)/.exec(
      markdown,
    );
  if (!match)
    throw new Error("Choose an Ellie’s Book Markdown library backup.");
  try {
    const data = JSON.parse(match[1]);
    return validate({
      ...data,
      books: data.books.map((book) => ({
        ...book,
        projects: book.projects.map(parseBook),
      })),
      ...(data.example ? { example: parseBook(data.example) } : {}),
    });
  } catch {
    throw new Error(
      "This library could not be read safely. Your saved books have not been replaced.",
    );
  }
}

export function readLibrary(storage) {
  const markdown = storage.getItem(LIBRARY_KEY);
  if (markdown !== null) return parseLibrary(markdown);
  const personal = readStoredBudget(storage, false);
  const selected = readStoredBudget(storage);
  const library = emptyLibrary();
  if (
    personal.created ||
    personal.name ||
    personal.total ||
    personal.expenses.length ||
    personal.notes
  ) {
    library.books = [
      {
        id: `book-${personal.id}`,
        name: personal.name || "My book",
        projects: [personal],
      },
    ];
    library.activeProjectId = personal.id;
  }
  if (selected.sample) {
    library.example = selected;
    library.activeProjectId = EXAMPLE_ID;
  }
  return validate(library);
}

export function changeLibrary(library, action) {
  let next = library;
  if (action.type === "book" || action.type === "project") {
    const ids = new Set(
      library.books.flatMap((book) =>
        book.projects.map((project) => project.id),
      ),
    );
    const project = { ...action.project, sample: false };
    if (ids.has(project.id) || project.id === EXAMPLE_ID) project.id = newId();
    if (action.type === "book") {
      next = {
        ...library,
        books: [
          ...library.books,
          { id: newId(), name: action.name.trim(), projects: [project] },
        ],
        activeProjectId: project.id,
      };
    } else {
      if (!library.books.some((book) => book.id === action.bookId))
        throw new Error("Choose a book first.");
      next = {
        ...library,
        books: library.books.map((book) =>
          book.id === action.bookId
            ? { ...book, projects: [...book.projects, project] }
            : book,
        ),
        activeProjectId: project.id,
      };
    }
  } else if (action.type === "update") {
    if (action.project.id !== activeBudget(library)?.id)
      throw new Error("Open this project before editing it.");
    next =
      library.activeProjectId === EXAMPLE_ID
        ? { ...library, example: action.project }
        : {
            ...library,
            books: library.books.map((book) => ({
              ...book,
              projects: book.projects.map((project) =>
                project.id === action.project.id ? action.project : project,
              ),
            })),
          };
  } else if (action.type === "select") {
    next = { ...library, activeProjectId: action.id };
  } else if (action.type === "profile") {
    next = { ...library, profile: { name: action.name.trim() } };
  } else if (action.type === "example") {
    next = {
      ...library,
      example: exampleBudget(),
      activeProjectId: EXAMPLE_ID,
    };
  } else if (action.type === "remove-example") {
    const { example: removed, ...rest } = library;
    void removed;
    next = {
      ...rest,
      activeProjectId: library.books[0]?.projects[0]?.id ?? "",
    };
  }
  return validate(next);
}

export function restoreLibrary(library, markdown) {
  const incoming = /^---\r?\nschema: ellies-book\/library-v1\r?\n/.test(
    markdown,
  )
    ? parseLibrary(markdown)
    : { books: [{ name: "Restored book", projects: [parseBook(markdown)] }] };
  let merged = library;
  const usedIds=new Set(library.books.flatMap(b=>b.projects.map(p=>p.id)));
  for (const book of incoming.books) {
    let bookId;
    // A restored copy can sit beside its original. Import history points into
    // the restored book, never at the old project's identically named entries.
    const ids=new Map(book.projects.map(p=>{const id=usedIds.has(p.id)||p.id===EXAMPLE_ID?newId():p.id;usedIds.add(id);return [p.id,id];}));
    for (const original of book.projects) {
      const project={...original,id:ids.get(original.id),...(original.statementImports?{statementImports:{...original.statementImports,batches:original.statementImports.batches.map(b=>({...b,items:b.items.map(i=>({...i,projectId:ids.get(i.projectId)??i.projectId}))}))}}:{})};
      merged = changeLibrary(
        merged,
        bookId
          ? { type: "project", bookId, project }
          : { type: "book", name: `${book.name} (restored)`, project },
      );
      bookId ??= merged.books.at(-1).id;
    }
  }
  if (!incoming.books.length)
    throw new Error("This backup has no personal books to add.");
  return merged;
}

export function initialProject() {
  return blankBudget("Household", { id: "unopened-project", period: "" });
}
