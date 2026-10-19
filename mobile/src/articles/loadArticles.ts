import type { Article } from '@repdraft/domain/articles';
import {
	filterArticles,
	sortArticlesForHub,
	resolveArticleCoverIcon
} from '@repdraft/domain/articles';
import raw from '../../assets/data/articles.json';

export function loadArticles(): Article[] {
	return (raw as Article[]).filter((a) => a?.slug && a?.title);
}

export { filterArticles, sortArticlesForHub, resolveArticleCoverIcon };
