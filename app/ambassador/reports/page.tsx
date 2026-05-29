'use client';

import { Suspense } from 'react';
import AmbassadorReports from '../views/AmbassadorReports';

export default function ReportsPage() {
    return (
        <Suspense
            fallback={
                <div className="d-flex justify-content-center align-items-center p-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading reports...</span>
                    </div>
                </div>
            }
        >
            <AmbassadorReports />
        </Suspense>
    );
}
