provider "aws" {
    region = "us-east-1"
}

# create SNS
resource "aws_sns_topic" "p0tion_sns_topic" {
  name = "p0tion_sns_topic"
}

# create Lambda execution role
data "aws_iam_policy_document" "p0tion_assume_role_policy_lambda" {
    statement {
      actions = ["sts:AssumeRole"]

      principals {
        type        = "Service"
        identifiers = ["lambda.amazonaws.com"]
      }
    }
}

resource "aws_iam_role" "p0tion_lambda_role" {
  name               = "p0tion_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.p0tion_assume_role_policy_lambda.json
}

# Execution role with EC2 and logs permissions
resource "aws_iam_role_policy" "p0tion_lambda_exec_role_policy" {
    name = "p0tion_lambda_exec_role_policy"
    role = aws_iam_role.p0tion_lambda_role.id

    policy = <<EOF
{
"Version": "2012-10-17",
"Statement": [
    {
        "Sid": "p0tionLambdaExec",
        "Effect": "Allow",
        "Action": [
            "ec2:DescribeInstances",
            "ec2:StopInstances",
            "ec2:CreateTags",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
        ],
        "Resource": "*"
    }
]
}
    EOF
}

# Deploy the Lambda with the code to stop the EC2 instance
resource "aws_lambda_function" "p0tion_lambda_stop_vm" {
    filename = "./lambda.zip"
    function_name = "p0tion_lambda_stop_vm"
    role = aws_iam_role.p0tion_lambda_role.arn
    handler = "index.handler"

    runtime = "nodejs18.x"
    source_code_hash = filebase64sha256("./lambda.zip")
    timeout = 300

    environment {
        variables = {
            SNS_TOPIC_ARN = aws_sns_topic.p0tion_sns_topic.arn
        }
    }
}

# Allow the lambda to be triggered by SNS
resource "aws_lambda_permission" "sns" {
    statement_id = "AllowExecutionFromSNS"
    action = "lambda:InvokeFunction"
    function_name = aws_lambda_function.p0tion_lambda_stop_vm.function_name
    principal = "sns.amazonaws.com"
    source_arn = aws_sns_topic.p0tion_sns_topic.arn
}

resource "aws_sns_topic_subscription" "lambda" {
    topic_arn = aws_sns_topic.p0tion_sns_topic.arn
    protocol = "lambda"
    endpoint = aws_lambda_function.p0tion_lambda_stop_vm.arn
}

# Create instance role for EC2
data "aws_iam_policy_document" "p0tion_assume_role_policy_ec2" {
    statement {
        actions = ["sts:AssumeRole"]
    
        principals {
            type        = "Service"
            identifiers = ["ec2.amazonaws.com"]
        }
    }
}

# Associate the role with the instance profile
resource "aws_iam_role" "p0tion_ec2_role" {
    name = "p0tion_ec2_role"
    assume_role_policy = data.aws_iam_policy_document.p0tion_assume_role_policy_ec2.json
}

resource "aws_iam_instance_profile" "p0tion_ec2_instance_profile" {
  name = "p0tion_ec2_instance_profile"
  role = aws_iam_role.p0tion_ec2_role.name
}

# EC2 SNS policy
resource "aws_iam_role_policy" "p0tion_ec2_sns" {
    name = "p0tion_ec2_sns"
    role = aws_iam_role.p0tion_ec2_role.id 

    policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
        "Sid": "p0tionEC2SNS",
        "Effect": "Allow",
        "Action": "sns:Publish",
        "Resource": "${aws_sns_topic.p0tion_sns_topic.arn}"
        }
    ]
}
    EOF
}

# EC2 S3 and SSM policy
resource "aws_iam_role_policy" "p0tion_ec2_s3_ssm" {
    name = "p0tion_ec2_s3_ssm"
    role = aws_iam_role.p0tion_ec2_role.id 

    policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
        "Sid": "p0tionEc2S3SSM",
        "Effect": "Allow",
        "Action": [
            "s3:ListBucket",
            "s3:PutObject",
            "s3:GetObject",
            "s3:PutObjectAcl",
            "ssm:UpdateInstanceInformation",
            "ssmmessages:CreateControlChannel",
            "ssmmessages:CreateDataChannel",
            "ssmmessages:OpenControlChannel",
            "ssmmessages:OpenDataChannel"
        ],
            "Resource": "*"
        }
    ]
}
    EOF
}

# IAM user for all operations 
resource "aws_iam_user" "p0tion_iam_user" {
    name = "p0tion_iam_user"
}

resource "aws_iam_access_key" "p0tion_access_key" {
  user = aws_iam_user.p0tion_iam_user.name
}

resource "aws_iam_user_policy" "p0tion_s3_ssm" {
  name = "p0tion_s3_ssm"
  user = aws_iam_user.p0tion_iam_user.name

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3andEC2andSSM",
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:ListBucket",
                "s3:ListMultipartUploadParts",
                "s3:GetObject",
                "s3:AbortMultipartUpload",
                "s3:GetObjectVersion",
                "s3:HeadBucket",
                "ec2:RunInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:CreateTags",
                "iam:PassRole",
                "ssm:SendCommand",
                "ssm:GetCommandInvocation"
            ],
            "Resource": "*"
        }
    ]
}
EOF
}

resource "aws_iam_user_policy" "p0tion_ec2_privileged" {
  name = "p0tion_ec2_privileged"
  user = aws_iam_user.p0tion_iam_user.name

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "EC2Privileged",
            "Effect": "Allow",
            "Action": [
                "ec2:StopInstances",
                "ec2:TerminateInstances",
                "ec2:StartInstances"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:ResourceTag/Name": "p0tionec2instance"
                }
            }
        }
    ]
}
EOF
}

resource "aws_iam_user_policy" "p0tion_s3_privileged" {
  name = "p0tion_s3_privileged"
  user = aws_iam_user.p0tion_iam_user.name

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3Privileged",
            "Effect": "Allow",
            "Action": [
                "s3:DeleteObject",
                "s3:DeleteBucket",
                "s3:PutBucketPublicAccessBlock",
                "s3:PutBucketCORS",
                "s3:PutBucketObjectLockConfiguration",
                "s3:PutBucketAcl",
                "s3:PutBucketVersioning",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:PutBucketOwnershipControls"
            ],
            "Resource": "*"
        }
    ]
}
EOF
}

# The user access keys
output "access_key" {
  value = aws_iam_access_key.p0tion_access_key.id
  description = "The access key ID"
}

output "secret_key" {
  value = aws_iam_access_key.p0tion_access_key.secret
  description = "The secret access key. This key will be encrypted and stored in the state file, use terraform output secret_key"
  sensitive = true
}

# The EC2 ARN
output "p0tion_instance_profile_arn" {
  value = aws_iam_instance_profile.p0tion_ec2_instance_profile.arn
  description = "The ec2 profile arn to put in the .env"
}

# The EC2 role ARN
output "p0tion_ec2_role_arn" {
  value = aws_iam_role.p0tion_ec2_role.arn
  description = "The ec2 role arn to put in the .env"
}

# The SNS ARN
output "p0tion_sns_topic_arn" {
    value = aws_sns_topic.p0tion_sns_topic.arn
    description = "The sns topic arn to put in the .env"
}