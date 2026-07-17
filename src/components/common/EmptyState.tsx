interface EmptyStateProps {
  titre: string;
  description: string;
  action?: JSX.Element;
}

export function EmptyState({ titre, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <h2>{titre}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
