<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Auth\LoginAddress;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

#[Description('List the accounts whose e-mail addresses differ only by case or surrounding spaces, without changing them')]
#[Signature('users:report-duplicate-emails')]
class ReportDuplicateEmailsCommand extends Command
{
    public function handle(): int
    {
        $this->info('Looking for accounts that share an address...');

        $groups = $this->duplicateGroups();

        if ($groups->isEmpty()) {
            $this->comment('No duplicate addresses: nothing to resolve.');

            return self::SUCCESS;
        }

        $groups->each(function (Collection $accounts, string $address): void {
            $this->newLine();
            $this->warn("{$address} is shared by {$accounts->count()} accounts:");

            $accounts->each(function (User $account): void {
                $verified = $account->email_verified_at === null ? 'not verified' : 'verified';
                $role = $account->is_instance_admin ? 'instance admin' : 'member';

                $this->line("  {$account->id}  {$account->email}  ({$account->name}, {$verified}, {$role}, created {$account->created_at})");
            });
        });

        $addresses = $groups->count() === 1 ? '1 address is' : "{$groups->count()} addresses are";

        $this->newLine();
        $this->comment("{$addresses} shared by several accounts. Nothing was changed: change or remove accounts until each address has one.");

        return self::SUCCESS;
    }

    /** @return Collection<string, EloquentCollection<int, User>> */
    private function duplicateGroups(): Collection
    {
        return User::query()
            ->oldest()
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'email_verified_at', 'is_instance_admin', 'created_at'])
            ->mapToGroups(fn (User $account): array => [LoginAddress::normalise($account->email) => $account])
            ->filter(fn (Collection $accounts): bool => $accounts->count() > 1)
            ->sortKeys();
    }
}
