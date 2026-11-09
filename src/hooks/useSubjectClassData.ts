import type { SubjectClassCache } from "../services/subjectClassCache";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClassSectionSummary, loadSubjectClassDetail, loadSubjectClassSummaries, SectionRecord } from "../services/carryMarkApi";
import { userError } from "../utils/errors";

export function useSubjectClassData(offeringId: string, offeringIds?: string[], cache?: SubjectClassCache) {
  const allocationKey = JSON.stringify(offeringIds ?? [offeringId]);
  const [summaries, setSummaries] = useState<{ key: string; rows: ClassSectionSummary[] } | null>(null);
  const hasLoaded = summaries?.key === allocationKey;
  const sections = hasLoaded ? summaries.rows : [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Awaited<ReturnType<typeof loadSubjectClassDetail>> & { sectionId: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const summaryRequest = useRef(0);
  const detailRequest = useRef(0);
  const selectedOfferingId = sections.find(section => section.id === selectedId)?.offeringId;

  const loadSummaries = useCallback(async () => {
    const request = ++summaryRequest.current;
    setLoading(true); setError("");
    try {
      const fetch = () => loadSubjectClassSummaries(JSON.parse(allocationKey));
      const rows = await (cache ? cache.readSummaries(allocationKey, fetch) : fetch());
      if (request === summaryRequest.current) setSummaries({ key: allocationKey, rows });
      return rows;
    } catch (reason) {
      if (request === summaryRequest.current) setError(userError(reason, "Unable to load classes."));
      throw reason;
    } finally {
      if (request === summaryRequest.current) setLoading(false);
    }
  }, [allocationKey, cache]);

  const loadDetail = useCallback(async (section: ClassSectionSummary) => {
    const request = ++detailRequest.current;
    setDetailLoading(true); setError("");
    try {
      const fetch = () => loadSubjectClassDetail(section);
      const result = await (cache ? cache.readDetail(section.id, fetch) : fetch());
      if (request === detailRequest.current) setDetail({ ...result, sectionId: section.id });
    } catch (reason) {
      if (request === detailRequest.current) setError(userError(reason, "Unable to load this class's marks."));
      throw reason;
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    setSelectedId(null); setDetail(null);
    void loadSummaries().catch(() => undefined);
    return () => { summaryRequest.current++; detailRequest.current++; };
  }, [loadSummaries]);

  useEffect(() => {
    const section = sections.find(item => item.id === selectedId);
    if (section) void loadDetail(section).catch(() => undefined);
    else { detailRequest.current++; setDetailLoading(false); }
    return () => { detailRequest.current++; };
  }, [selectedId, selectedOfferingId, loadDetail]);

  const reload = async (scope: "all" | "detail" = "all") => {
    if (scope === "detail") {
      if (selectedId) cache?.invalidateDetail(selectedId);
      const section = sections.find(item => item.id === selectedId);
      if (section) await loadDetail(section);
      return;
    }
    cache?.invalidate(selectedId ?? undefined);
    // Mutations may change join codes, labels, capacity or programme metadata.
    // Feed the fresh summary into the detail mapper, never the pre-mutation row.
    const rows = await loadSummaries();
    const section = rows.find(item => item.id === selectedId);
    if (section) await loadDetail(section);
  };
  const updateDetailedSections = (update: (sections: SectionRecord[]) => SectionRecord[]) => {
    if (selectedId) cache?.invalidateDetail(selectedId);
    setDetail(current => current ? { ...current, data: { ...current.data, sections: update(current.data.sections) } } : current);
  };
  useEffect(() => {
    if (!cache) return;
    const refresh = () => { cache.invalidate(); void reload().catch(() => undefined); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [cache, selectedId, loadSummaries, loadDetail]);
  const activeDetail = hasLoaded && detail?.sectionId === selectedId ? detail : null;
  return {
    sections, selectedId, setSelectedId,
    selected: activeDetail?.data.sections.find(section => section.id === selectedId) ?? null,
    assessments: activeDetail?.data.assessments ?? [],
    carryMax: activeDetail?.settings.carryMax ?? null,
    eligibleThreshold: activeDetail?.settings.eligibleThreshold ?? null,
    loading, hasLoaded, detailLoading, error, reload, updateDetailedSections,
  };
}
