import type { PageRoute } from '@shared/types/feature';

export function resolvePageRoute(location: Location): PageRoute {
    const { pathname } = location;

    if (/\/user\/\d+/.test(pathname)) {
        return 'profile';
    }
    if (/\/review\/user_tags\//.test(pathname)) {
        return 'tag-detail';
    }
    if (/\/problem/.test(pathname)) {
        return 'problem-list';
    }

    return 'unknown';
}
