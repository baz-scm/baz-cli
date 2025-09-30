import { useState, useEffect } from 'react';

export interface Repository {
    id: number;
    fullName: string;
    description?: string;
}

interface UsePullRequestsResult {
    pullRequests: Repository[];
    loading: boolean;
    error: Error | null;
}

async function fetchPullRequests(): Promise<Repository[]> {
    return [
        {
            id: 1,
            fullName: "baz-scm/frontend",

        },
        {
            id: 2,
            fullName: "baz-scm/bazai",
            description: "Extract interesting information from plain text log files",
        },
        {
            id: 3,
            fullName: "baz-scm/pet-store-demo",
            description: "Demo app",
        },
        {
            id: 4,
            fullName: "baz-scm/baz-cli",
        },
        {
            id: 5,
            fullName: "baz-scm/pgmq-ts",
            description: "Native SQL implementation for PGMQ in typescript, based on pgmq-rs",
        },
        {
            id: 6,
            fullName: "baz-scm/baz",
            description: "Next generation SCM that understands code and what it creates",
        },
        {
            id: 7,
            fullName: "baz-scm/diff-test",
            description: "Test diffs of different types",
        }
    ];
}



export function useRepositories() {
    const [data, setData] = useState<Repository[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPullRequests()
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return { data, loading, error };
}