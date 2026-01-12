import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgentSubmissions, BANK_GROUPS, SubmissionGroup } from '@/hooks/useAgentSubmissions';
import { FileText, Send } from 'lucide-react';

export const SubmissionForm: React.FC = () => {
  const { createSubmission } = useAgentSubmissions();
  const [selectedGroup, setSelectedGroup] = useState<SubmissionGroup>('group1');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) return;

    createSubmission.mutate({
      submission_group: selectedGroup,
      bank_name: selectedBank,
      notes: notes || undefined,
    });

    // Reset form
    setSelectedBank('');
    setNotes('');
  };

  const availableBanks = BANK_GROUPS[selectedGroup];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <FileText className="w-5 h-5 text-primary" />
          Daily Submission
        </CardTitle>
        <CardDescription>
          Submit your daily work for bank groups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Group</Label>
            <RadioGroup
              value={selectedGroup}
              onValueChange={(v) => {
                setSelectedGroup(v as SubmissionGroup);
                setSelectedBank('');
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="group1" id="group1" />
                <Label htmlFor="group1" className="font-normal cursor-pointer">
                  Group 1 (NBF, UBL)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="group2" id="group2" />
                <Label htmlFor="group2" className="font-normal cursor-pointer">
                  Group 2 (RAK, Mashreq, Wioriya)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Select Bank</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a bank" />
              </SelectTrigger>
              <SelectContent>
                {availableBanks.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about your submission..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={!selectedBank || createSubmission.isPending}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {createSubmission.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
