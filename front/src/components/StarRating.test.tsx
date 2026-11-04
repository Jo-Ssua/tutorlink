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

  it('ocupa una sola parada de tabulacion', () => {
    render(<StarRating value={3} onChange={vi.fn()} />);

    const stars = screen.getAllByRole('radio');
    expect(stars.filter((star) => star.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(stars[2]).toHaveAttribute('tabindex', '0');
  });

  it('se recorre con las flechas, como un grupo de radios', async () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);

    screen.getAllByRole('radio')[2].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(4);

    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(1);

    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('en modo lectura describe la calificacion sin controles', () => {
    render(<StarRating value={5} readOnly />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(
      screen.getByRole('img', { name: 'Calificación: 5 de 5 estrellas (Excelente)' }),
    ).toBeInTheDocument();
  });
});
