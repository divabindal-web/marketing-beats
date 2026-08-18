/**
 * Platform brand colours.
 *
 * This file used to be ~330 lines of mocked social metrics — three months
 * across four platforms, invented to make a demo dashboard look alive. The
 * pages that rendered them were removed once it was clear they showed made-up
 * figures under real colleagues' names. Only the colour map was ever real, and
 * it is all that is left.
 */

import { SocialMetricPlatform } from '@/types';

/** Brand colour for each platform — used in subtle pill backgrounds. */
export const PLATFORM_COLOR: Record<
  SocialMetricPlatform,
  { bg: string; text: string; border: string; dot: string }
> = {
  YouTube: {
    bg: 'rgba(220, 38, 38, 0.08)',
    text: '#b91c1c',
    border: 'rgba(220, 38, 38, 0.18)',
    dot: '#dc2626',
  },
  LinkedIn: {
    bg: 'rgba(10, 102, 194, 0.08)',
    text: '#0a66c2',
    border: 'rgba(10, 102, 194, 0.18)',
    dot: '#0a66c2',
  },
  Instagram: {
    bg: 'rgba(193, 53, 132, 0.08)',
    text: '#a32a72',
    border: 'rgba(193, 53, 132, 0.18)',
    dot: '#c13584',
  },
  Facebook: {
    bg: 'rgba(24, 119, 242, 0.08)',
    text: '#1565c0',
    border: 'rgba(24, 119, 242, 0.18)',
    dot: '#1877f2',
  },
};
