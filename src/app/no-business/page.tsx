import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NoBusinessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No business linked</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your account is not linked to any business yet. Ask an administrator
          to invite you, or run the dev seed SQL to attach yourself to a
          business.
        </CardContent>
      </Card>
    </div>
  );
}
