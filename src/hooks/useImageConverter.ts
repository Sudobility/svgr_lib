import { useCallback, useEffect, useState } from 'react';
import {
  svgrKeys,
  useCancelJob,
  useCreateJob,
  useImageJobs,
  useJobStatus,
  useUploadImage,
} from '@sudobility/svgr_client';
import type { ImageType, JobResult, SvgrClient } from '@sudobility/svgr_client';
import { useQueryClient } from '@tanstack/react-query';
import { QUALITY_DEFAULT } from '../config/constants.js';

export const OCR_SUPPORTED_IMAGE_TYPES: ReadonlySet<ImageType> = new Set([
  'auto',
  'design',
  'line_art',
  'logo',
  'manga',
  'poster',
  'screenshot_ui',
  'diagram',
  'blueprint_cad',
  'map',
  'chart_graph',
  'comic_western',
  'flat_infographic',
  'packaging_label',
  'document_scan',
  'icon_sheet',
  'sticker_sheet',
]);

export const TRANSPARENT_BG_SUPPORTED_IMAGE_TYPES: ReadonlySet<ImageType> =
  new Set([
    'auto',
    'design',
    'line_art',
    'logo',
    'illustration',
    'manga',
    'comic_western',
    'pixel_art',
    'engraving',
    'diagram',
    'blueprint_cad',
    'chart_graph',
    'flat_infographic',
    'icon_sheet',
    'sticker_sheet',
    'tattoo_flash',
    'silhouette_cutout',
    'emoji_moji',
  ]);

export interface ImageConverterState {
  quality: number;
  transparentBg: boolean;
  ocr: boolean;
  mergePaths: boolean;
  imageType: ImageType;
  supportsOcr: boolean;
  supportsTransparentBg: boolean;

  /** Server-assigned image ID after upload. */
  imageId: string | null;
  /** Whether an upload is in progress. */
  isUploading: boolean;

  /** ID of the job currently being tracked. */
  currentJobId: string | null;
  /** Latest polled data for the current job. */
  currentJob: JobResult | null;
  /** Whether a conversion is in progress (pending or processing). */
  isConverting: boolean;

  /** JPEG preview object URL (set when job completes). */
  previewUrl: string | null;
  /** SVG filename for download (not loaded into memory). */
  svgFilename: string | null;

  /** All jobs for the current image. */
  jobs: JobResult[];

  error: string | null;
}

export interface UseImageConverterReturn extends ImageConverterState {
  setQuality: (q: number) => void;
  setTransparentBg: (v: boolean) => void;
  setOcr: (v: boolean) => void;
  setMergePaths: (v: boolean) => void;
  setImageType: (v: ImageType) => void;

  /** Upload an image file to the server. */
  upload: (file: File) => Promise<void>;
  /** Create a conversion job with current settings. Image must be uploaded first. */
  convert: () => void;
  /** Cancel the job currently being tracked, if any is still in progress. */
  cancel: () => void;
  /** Reset all state. */
  reset: () => void;
  /** Switch preview to a different job's results. */
  selectJob: (jobId: string) => void;
  /** Fetch the SVG file from the server. */
  fetchSvg: () => Promise<Blob | null>;
}

/**
 * Optional function to scale a base64 image down to a max pixel count.
 * Returns the scaled base64 string (without data URL prefix).
 */
export type ScaleImageFn = (
  base64: string,
  maxPixels: number
) => Promise<string>;

export function supportsOcrOption(imageType: ImageType): boolean {
  return OCR_SUPPORTED_IMAGE_TYPES.has(imageType);
}

export function supportsTransparentBgOption(imageType: ImageType): boolean {
  return TRANSPARENT_BG_SUPPORTED_IMAGE_TYPES.has(imageType);
}

export function useImageConverter(
  client: SvgrClient,
  _scaleImage?: ScaleImageFn
): UseImageConverterReturn {
  const queryClient = useQueryClient();
  const uploadMutation = useUploadImage(client);
  const createJobMutation = useCreateJob(client);
  const cancelMutation = useCancelJob(client);

  const [quality, setQuality] = useState(QUALITY_DEFAULT);
  const [transparentBg, setTransparentBgState] = useState(false);
  const [ocr, setOcrState] = useState(true);
  const [mergePaths, setMergePaths] = useState(false);
  const [imageType, setImageTypeState] = useState<ImageType>('auto');
  const [imageId, setImageId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [svgFilename, setSvgFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll job status
  const jobStatusQuery = useJobStatus(client, currentJobId);
  const currentJob = jobStatusQuery.data?.data ?? null;

  // List all jobs for current image
  const imageJobsQuery = useImageJobs(client, imageId);
  const jobs = imageJobsQuery.data?.data ?? [];

  // When job completes, fetch the JPEG preview
  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.status === 'done' && currentJob.previewFilename) {
      setSvgFilename(currentJob.svgFilename ?? null);
      // Fetch preview JPEG
      client
        .fetchFile(currentJob.previewFilename)
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch(err => {
          console.error('Failed to fetch preview:', err);
        });
      // Refresh job list
      queryClient.invalidateQueries({
        queryKey: svgrKeys.imageJobs(currentJob.imageId),
      });
    } else if (currentJob.status === 'error') {
      setError(currentJob.errorMessage ?? 'Conversion failed');
    }
  }, [currentJob?.status, currentJob?.previewFilename]);

  const setTransparentBg = useCallback(
    (v: boolean) => {
      setTransparentBgState(supportsTransparentBgOption(imageType) ? v : false);
    },
    [imageType]
  );

  const setOcr = useCallback(
    (v: boolean) => {
      setOcrState(supportsOcrOption(imageType) ? v : false);
    },
    [imageType]
  );

  const setImageType = useCallback((nextImageType: ImageType) => {
    setImageTypeState(nextImageType);
    if (!supportsTransparentBgOption(nextImageType)) {
      setTransparentBgState(false);
    }
    if (!supportsOcrOption(nextImageType)) {
      setOcrState(false);
    }
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const response = await uploadMutation.mutateAsync(file);
        if (response.success && response.data) {
          setImageId(response.data.imageId);
        } else {
          setError((response as { error?: string }).error ?? 'Upload failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [uploadMutation]
  );

  const convert = useCallback(() => {
    if (!imageId) return;
    setError(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSvgFilename(null);

    createJobMutation
      .mutateAsync({
        imageId,
        quality,
        transparentBg,
        ocr,
        mergePaths,
        imageType,
      })
      .then(response => {
        if (response.success && response.data) {
          setCurrentJobId(response.data.jobId);
        } else {
          setError(
            (response as { error?: string }).error ?? 'Failed to create job'
          );
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to create job');
      });
  }, [
    imageId,
    quality,
    transparentBg,
    ocr,
    mergePaths,
    imageType,
    createJobMutation,
  ]);

  const cancel = useCallback(() => {
    if (!currentJobId) return;
    const status = currentJob?.status;
    if (status === 'done' || status === 'error' || status === 'cancelled') {
      return;
    }
    cancelMutation.mutate(currentJobId);
  }, [currentJobId, currentJob?.status, cancelMutation]);

  const reset = useCallback(() => {
    setImageId(null);
    setCurrentJobId(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSvgFilename(null);
    setError(null);
  }, []);

  const selectJob = useCallback(
    (jobId: string) => {
      const job = jobs.find(j => j.jobId === jobId);
      if (!job || job.status !== 'done') return;
      setCurrentJobId(jobId);
      setSvgFilename(job.svgFilename ?? null);
      if (job.previewFilename) {
        client
          .fetchFile(job.previewFilename)
          .then(blob => {
            const url = URL.createObjectURL(blob);
            setPreviewUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          })
          .catch(err => console.error('Failed to fetch preview:', err));
      }
    },
    [jobs, client]
  );

  const fetchSvg = useCallback(async (): Promise<Blob | null> => {
    if (!svgFilename) return null;
    try {
      return await client.fetchFile(svgFilename);
    } catch (err) {
      console.error('Failed to fetch SVG:', err);
      return null;
    }
  }, [svgFilename, client]);

  const isConverting =
    createJobMutation.isPending ||
    (currentJob !== null &&
      currentJob.status !== 'done' &&
      currentJob.status !== 'error' &&
      currentJob.status !== 'cancelled');

  return {
    quality,
    transparentBg,
    ocr,
    mergePaths,
    imageType,
    supportsOcr: supportsOcrOption(imageType),
    supportsTransparentBg: supportsTransparentBgOption(imageType),
    imageId,
    isUploading: uploadMutation.isPending,
    currentJobId,
    currentJob,
    isConverting,
    previewUrl,
    svgFilename,
    jobs,
    error,
    setQuality,
    setTransparentBg,
    setOcr,
    setMergePaths,
    setImageType,
    upload,
    convert,
    cancel,
    reset,
    selectJob,
    fetchSvg,
  };
}
