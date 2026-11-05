import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewForm } from './ReviewForm';

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onCancel = vi.fn();
  render(
    <ReviewForm
      tutorName="Diego Alejandro Rios"
      subjectName="Bases de Datos"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

describe('ReviewForm', () => {
  it('no envia nada sin estrellas y explica por que', async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /Enviar calificación/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/calificación es obligatoria/i);
  });

  it('envia la calificacion con comentario y anonimato', async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getByRole('radio', { name: /5 estrellas/ }));
    await userEvent.type(screen.getByLabelText(/Comentario/), '  Explico muy bien.  ');
    await userEvent.click(screen.getByRole('button', { name: /Enviar calificación/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      comment: 'Explico muy bien.',
      isAnonymous: true,
    });
  });

  it('cuenta los caracteres del comentario contra el tope del backend', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/Comentario/), 'Hola');

    expect(screen.getByText('4/2000')).toBeInTheDocument();
  });
});
