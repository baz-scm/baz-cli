const BAZ_REVIEWER_PATTERN =
  /^(https:\/\/github\.com\/apps\/)?baz-reviewer(\[bot])?$/i;

export function isBazReviewer(assignee: string): boolean {
  return BAZ_REVIEWER_PATTERN.test(assignee);
}
