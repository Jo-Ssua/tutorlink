import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('expone cinco opciones y marca la seleccionada', () => {
    render(<StarRating value={3} />);

    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-checked', 'true');
    expect(stars[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('informa la calificacion elegida', async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: /4 estrellas/ }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('en modo lectura describe la calificacion sin controles', () => {
    render(<StarRating value={5} readOnly />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(
      screen.getByRole('img', { name: 'Calificación: 5 de 5 estrellas (Excelente)' }),
    ).toBeInTheDocument();
  });
});
