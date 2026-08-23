import { useEffect, useState } from "react";
import { hashForRoute, routeFromHash } from "./routing.ts";

function useHashRoute(): string {
  const [route, setRoute] = useState(() =>
    routeFromHash(globalThis.location.hash)
  );

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash(globalThis.location.hash));
    globalThis.addEventListener("hashchange", updateRoute);
    return () => globalThis.removeEventListener("hashchange", updateRoute);
  }, []);

  return route;
}

export function FoundationShell() {
  const route = useHashRoute();
  const isNestedRoute = route === "/foundation/nested";

  return (
    <main>
      <p>Application foundation fixture</p>
      <h1>{isNestedRoute ? "Nested hash route" : "Foundation shell"}</h1>
      <p>
        This plain shell proves repository-relative hosting and is not a product
        screen.
      </p>
      <p>
        Current hash route: <code>{route}</code>
      </p>
      <nav aria-label="Foundation fixture routes">
        <a href={hashForRoute("/")}>Root route</a>{" "}
        <a href={hashForRoute("/foundation/nested")}>Nested route</a>
      </nav>
    </main>
  );
}
