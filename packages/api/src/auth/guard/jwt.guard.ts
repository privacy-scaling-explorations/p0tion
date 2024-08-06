import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { JWTDto } from "../dto/auth-dto"

@Injectable()
export class JWTGuard implements CanActivate {
    constructor(private jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const authHeader = request.headers.authorization
        const token = extractTokenFromHeader(authHeader)
        try {
            const payload = (await this.jwtService.verifyAsync(token, {
                secret: process.env.SUPABASE_JWT_SECRET
            })) as JWTDto
            // 💡 We're assigning the payload to the request object here
            // so that we can access it in our route handlers
            request["jwt"] = payload
        } catch (e) {
            throw new UnauthorizedException()
        }
        return true
    }
}

export function extractTokenFromHeader(authHeader: string | undefined | null): string | undefined {
    if (!authHeader) {
        return undefined
    }
    const [type, token] = authHeader.split(" ") ?? []
    return type === "Bearer" ? token : undefined
}