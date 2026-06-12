'use client';

import { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import axios from 'axios';
import { ENROLLMENT_FACULTY_UNSPECIFIED } from '@/lib/ambassador/enrollment-records';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
};

export default function FacultySelectField({
  value,
  onChange,
  disabled,
  required = true,
  label = 'Faculty / school',
}: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/enrollment/faculties')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.faculties) ? res.data.faculties : [];
        setOptions(list.filter((f: string) => f && f !== ENROLLMENT_FACULTY_UNSPECIFIED));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Form.Group className="mb-3">
      <Form.Label className="fw-bold small">{label}</Form.Label>
      <Form.Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        required={required}
      >
        <option value="">{loading ? 'Loading faculties…' : 'Select faculty / school'}</option>
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        {value && !options.includes(value) && value !== ENROLLMENT_FACULTY_UNSPECIFIED && (
          <option value={value}>{value}</option>
        )}
      </Form.Select>
    </Form.Group>
  );
}
