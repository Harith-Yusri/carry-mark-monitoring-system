import { useCallback, useEffect, useRef, useState } from "react";
import { ClassSectionSummary, loadSubjectClassDetail, loadSubjectClassSummaries, SectionRecord } from "../services/carryMarkApi";
import { userError } from "../utils/errors";

export function useSubjectClassData(offeringId: string, offeringIds?: string[]) {
  const allocationKey = JSON.stringify(offeringIds ?? [offeringId]);
  const [sections, setSections] = useState<ClassSectionSummary[]>([]);
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
      const rows = await loadSubjectClassSummaries(JSON.parse(allocationKey));
      if (request === summaryRequest.current) setSections(rows);
      return rows;
    } catch (reason) {
      if (request === summaryRequest.current) setError(userError(reason, "Unable to load classes."));
      throw reason;
    } finally {
      if (request === summaryRequest.current) setLoading(false);
    }
  }, [allocationKey]);

  const loadDetail = useCallback(async (section: ClassSectionSummary) => {
    const request = ++detailRequest.current;
    setDetailLoading(true); setError("");
    try {
      const result = await loadSubjectClassDetail(section);
      if (request === detailRequest.current) setDetail({ ...result, sectionId: section.id });
    } catch (reason) {
      if (request === detailRequest.current) setError(userError(reason, "Unable to load this class's marks."));
      throw reason;
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }, []);

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

  const reload = async () => {
    // Mutations may change join codes, labels, capacity or programme metadata.
    // Feed the fresh summary into the detail mapper, never the pre-mutation row.
    const rows = await loadSummaries();
    const section = rows.find(item => item.id === selectedId);
    if (section) await loadDetail(section);
  };
  const updateDetailedSections = (update: (sections: SectionRecord[]) => SectionRecord[]) => {
    setDetail(current => current ? { ...current, data: { ...current.data, sections: update(current.data.sections) } } : current);
  };
  const activeDetail = detail?.sectionId === selectedId ? detail : null;
  return {
    sections, selectedId, setSelectedId,
    selected: activeDetail?.data.sections.find(section => section.id === selectedId) ?? null,
    assessments: activeDetail?.data.assessments ?? [],
    carryMax: activeDetail?.settings.carryMax ?? null,
    eligibleThreshold: activeDetail?.settings.eligibleThreshold ?? null,
    loading, detailLoading, error, reload, updateDetailedSections,
  };
}
