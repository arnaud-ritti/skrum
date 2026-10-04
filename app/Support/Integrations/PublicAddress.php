<?php

namespace App\Support\Integrations;

/**
 * Spec 8 §4.5: loopback, RFC 1918, link-local, CGNAT, "this network", ULA,
 * multicast, documentation and reserved ranges are never public.
 */
class PublicAddress
{
    /**
     * @var array<int, string>
     */
    private const array BlockedRanges = [
        '0.0.0.0/8',
        '10.0.0.0/8',
        '100.64.0.0/10',
        '127.0.0.0/8',
        '169.254.0.0/16',
        '172.16.0.0/12',
        '192.0.0.0/24',
        '192.0.2.0/24',
        '192.88.99.0/24',
        '192.168.0.0/16',
        '198.18.0.0/15',
        '198.51.100.0/24',
        '203.0.113.0/24',
        '224.0.0.0/4',
        '240.0.0.0/4',
        '::/96',
        '::ffff:0:0/96',
        '64:ff9b::/96',
        '64:ff9b:1::/48',
        '100::/64',
        '2001::/32',
        '2001:db8::/32',
        '2002::/16',
        'fc00::/7',
        'fec0::/10',
        'fe80::/10',
        'ff00::/8',
    ];

    public static function isPublic(string $address): bool
    {
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return false;
        }
        return array_all(self::BlockedRanges, fn(string $range): bool => !self::inRange($address, $range));
    }

    public static function inRange(string $address, string $cidr): bool
    {
        [$subnet, $bits] = explode('/', $cidr, 2);
        $addressBytes = @inet_pton($address);
        $subnetBytes = @inet_pton($subnet);

        if ($addressBytes === false || $subnetBytes === false || strlen($addressBytes) !== strlen($subnetBytes)) {
            return false;
        }

        $prefixLength = (int) $bits;
        $fullBytes = intdiv($prefixLength, 8);

        if (strncmp($addressBytes, $subnetBytes, $fullBytes) !== 0) {
            return false;
        }

        $remainingBits = $prefixLength % 8;

        if ($remainingBits === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $remainingBits)) & 0xFF;

        return (ord($addressBytes[$fullBytes]) & $mask) === (ord($subnetBytes[$fullBytes]) & $mask);
    }
}
