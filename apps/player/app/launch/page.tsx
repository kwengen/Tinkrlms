const CMI5_PARAMS = ["endpoint", "fetch", "actor", "registration", "activityId"] as const;

export default function LaunchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const contentBase = searchParams.contentBase as string | undefined;
  const launchPath = searchParams.launchPath as string | undefined;

  if (!contentBase || !launchPath) {
    return <p className="p-8 text-sm text-red-700">Missing launch parameters.</p>;
  }

  // Same-origin inner iframe holding the actual (unclarified) AU content —
  // bestilling §3's second nesting level. The 5 standard cmi5 query params
  // are re-attached here because the AU reads them from ITS OWN
  // window.location.search; nesting an iframe does not forward them.
  const contentUrl = new URL(`${contentBase}/${launchPath}`);
  for (const key of CMI5_PARAMS) {
    const value = searchParams[key];
    if (typeof value === "string") contentUrl.searchParams.set(key, value);
  }

  return (
    <iframe
      src={contentUrl.toString()}
      title="cmi5 AU"
      className="h-screen w-full border-0"
    />
  );
}
